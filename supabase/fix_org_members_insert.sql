-- =====================================================================================================================
-- Membership hardening (security). Rode no SQL editor do Supabase DEPOIS de rls_policies.sql e de
-- 00_preflight_security.sql (que precisa passar). Idempotente. Tudo numa transação: se algo falhar, nada muda
-- (se o editor/psql ficar em "current transaction is aborted", rode ROLLBACK;).
--
-- O que muda:
--   1. organization_members: a policy "Authenticated users can join organizations" (WITH CHECK auth.uid() IS NOT NULL)
--      deixava qualquer usuário logado entrar em QUALQUER org, com QUALQUER user_id. Agora o cliente só insere a si
--      mesmo numa org da qual é dono (criar org). Convidados entram só pela RPC accept_invitation (SECURITY DEFINER), que
--      confere o convite pelo e-mail confirmado do usuário no servidor.
--      "Owners can manage members" (FOR ALL) virou só DELETE: com FOR ALL o dono podia inserir/alterar linhas de
--      qualquer user_id; o app só insere (criar org) e apaga (remover membro).
--   2. organizations: INSERT exige owner_id = auth.uid() (antes aceitava owner_id de outra pessoa).
--   3. team_members: trigger que impede o cliente de vincular user_id a outra pessoa (a policy FOR ALL deixa qualquer
--      membro da org escrever qualquer user_id), de desvincular, e de trocar e-mail/org de uma linha já vinculada.
--   4. Aceite de convite: novas RPCs pending_invitations() e accept_invitation(id), chamadas pelo banner da UI.
--   5. Funções SECURITY DEFINER com search_path fixo (public, pg_temp); EXECUTE tirado de anon.
--   6. No fim, confere que não sobrou outra policy permissiva de escrita nessas tabelas (senão aborta tudo).
--
-- Policies que este arquivo assume (rls_policies.sql) e DROPA pelo nome exato:
--   organization_members: "Authenticated users can join organizations" (INSERT), "Owners can manage members" (ALL)
--   organizations:        "Authenticated users can create organizations" (INSERT)
-- e que ficam como estão: organization_members "Users can view members of their organizations" (SELECT);
--   organizations "Users can view their organizations", "Owners can update their organizations", "Owners can delete
--   their organizations"; team_members "Users can access team members" (ALL).
--
-- Fluxos do app que continuam funcionando:
--   - Criar org (createOrganization em src/lib/api.ts): INSERT organizations (owner_id = eu) -> INSERT
--     organization_members (eu, sou dono) -> INSERT team_members (user_id = eu, email = meu e-mail confirmado).
--   - Convidar (inviteMember): INSERT organization_invitations + team_members placeholder (user_id NULL): inalterado.
--   - Aceitar: accept_invitation(id) insere organization_members e vincula o placeholder (ou cria a linha do time).
--   - Remover membro (deleteMember): DELETE team_members (qualquer membro), DELETE organization_members (só o dono,
--     como antes), DELETE organization_invitations (qualquer membro): inalterado.
--   - Editar apelido/papel/commit_log (updateMember): não mexe em user_id/email/org: inalterado.
--
-- Rollback (volta ao estado anterior, INSEGURO):
--   BEGIN;
--   DROP TRIGGER IF EXISTS guard_team_member_link ON public.team_members;
--   DROP POLICY IF EXISTS "Owners can add themselves" ON public.organization_members;
--   DROP POLICY IF EXISTS "Owners can remove members" ON public.organization_members;
--   CREATE POLICY "Authenticated users can join organizations" ON public.organization_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
--   CREATE POLICY "Owners can manage members" ON public.organization_members FOR ALL USING (EXISTS (SELECT 1 FROM public.organizations
--       WHERE organizations.id = organization_members.organization_id AND organizations.owner_id = auth.uid()));
--   DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
--   CREATE POLICY "Authenticated users can create organizations" ON public.organizations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
--   DROP FUNCTION IF EXISTS public.guard_team_member_link(), public.accept_invitation(uuid), public.pending_invitations(),
--       public.is_org_owner(uuid), public.my_confirmed_email();
--   COMMIT;
--   (o search_path fixo das funções pode ficar; para tirar: ALTER FUNCTION public.check_is_org_member(uuid) RESET search_path;)
-- =====================================================================================================================

BEGIN;

-- 1. Helpers (SECURITY DEFINER: leem tabelas cujo RLS o usuário não passa, sem recursão de policy)
ALTER FUNCTION public.check_is_org_member(uuid) SET search_path = public, pg_temp;
DO $$
BEGIN
    IF to_regprocedure('public.handle_first_org_claim()') IS NOT NULL THEN
        ALTER FUNCTION public.handle_first_org_claim() SET search_path = public, pg_temp;
    END IF;
END $$;

-- E-mail do usuário logado direto de auth.users (fonte da verdade; o claim do JWT pode estar velho), só se confirmado.
CREATE OR REPLACE FUNCTION public.my_confirmed_email()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT lower(email::text) FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT EXISTS (SELECT 1 FROM public.organizations WHERE id = org_id AND owner_id = auth.uid())
$$;

-- 2. organization_members
DROP POLICY IF EXISTS "Authenticated users can join organizations" ON public.organization_members;
DROP POLICY IF EXISTS "Owners can manage members" ON public.organization_members;
DROP POLICY IF EXISTS "Users can join as owner or invitee" ON public.organization_members; -- nome de uma versão anterior deste arquivo

DROP POLICY IF EXISTS "Owners can add themselves" ON public.organization_members;
CREATE POLICY "Owners can add themselves" ON public.organization_members
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_org_owner(organization_id));

DROP POLICY IF EXISTS "Owners can remove members" ON public.organization_members;
CREATE POLICY "Owners can remove members" ON public.organization_members
FOR DELETE TO authenticated USING (public.is_org_owner(organization_id));
-- SELECT continua com "Users can view members of their organizations" (rls_policies.sql). Sem UPDATE pelo cliente.

DROP FUNCTION IF EXISTS public.has_pending_invitation(uuid); -- versão anterior: o convidado não insere direto, só pela RPC

-- 3. organizations: só cria org em nome próprio
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
CREATE POLICY "Authenticated users can create organizations" ON public.organizations
FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

-- 4. team_members: user_id só pode ser vinculado a si mesmo (NULL -> auth.uid(), com o próprio e-mail confirmado); uma
--    linha vinculada não muda de e-mail, de org, nem é desvinculada. Service role / SQL editor (auth.uid() NULL) passam.
--    Sem isso, um colega vincularia uma linha dele ao user_id da vítima e o runner da vítima pegaria as tarefas dela.
CREATE OR REPLACE FUNCTION public.guard_team_member_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id THEN
        IF NEW.user_id IS NOT NULL
           AND (NEW.email IS DISTINCT FROM OLD.email OR NEW.organization_id IS DISTINCT FROM OLD.organization_id) THEN
            RAISE EXCEPTION 'the email/organization of a linked team member cannot be changed' USING ERRCODE = '42501';
        END IF;
        RETURN NEW;
    END IF;
    IF TG_OP = 'INSERT' AND NEW.user_id IS NULL THEN
        RETURN NEW; -- placeholder de convite / membro sem conta
    END IF;
    IF NEW.user_id = auth.uid()
       AND (TG_OP = 'INSERT' OR OLD.user_id IS NULL)
       AND lower(NEW.email::text) = public.my_confirmed_email() THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'team_members.user_id can only be linked to yourself' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS guard_team_member_link ON public.team_members;
CREATE TRIGGER guard_team_member_link
    BEFORE INSERT OR UPDATE ON public.team_members
    FOR EACH ROW EXECUTE FUNCTION public.guard_team_member_link();

-- 5. Convites: listar os meus pendentes e aceitar um (o banner da UI chama as duas). O e-mail vem de auth.users no
--    servidor (my_confirmed_email), nunca de parâmetro.
CREATE OR REPLACE FUNCTION public.pending_invitations()
RETURNS TABLE (id uuid, organization_id uuid, organization_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
    SELECT i.id, i.organization_id, o.name::text
    FROM public.organization_invitations i
    JOIN public.organizations o ON o.id = i.organization_id
    WHERE lower(i.email::text) = public.my_confirmed_email()
      AND NOT EXISTS (
          SELECT 1 FROM public.organization_members m WHERE m.organization_id = i.organization_id AND m.user_id = auth.uid()
      )
$$;

-- Aceite explícito (clique). Não é automático no login: aceitar sozinho deixaria qualquer um "puxar" a vítima para a
-- própria org (e o espelho de todos do agente cairia num card dessa org).
CREATE OR REPLACE FUNCTION public.accept_invitation(p_invitation_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    inv record;
    mail text := public.my_confirmed_email();
    row_id uuid;
BEGIN
    IF auth.uid() IS NULL OR mail IS NULL THEN
        RAISE EXCEPTION 'not authenticated or email not confirmed' USING ERRCODE = '42501';
    END IF;
    SELECT * INTO inv FROM public.organization_invitations WHERE id = p_invitation_id AND lower(email::text) = mail;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'invitation not found' USING ERRCODE = 'P0002';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = inv.organization_id AND user_id = auth.uid()) THEN
        INSERT INTO public.organization_members (organization_id, user_id, role) VALUES (inv.organization_id, auth.uid(), 'member');
    END IF;
    -- Já tenho linha vinculada nessa org? Então não vincula mais nada.
    IF EXISTS (SELECT 1 FROM public.team_members WHERE organization_id = inv.organization_id AND user_id = auth.uid()) THEN
        RETURN inv.organization_id;
    END IF;
    -- Vincula UM placeholder criado por inviteMember (passa no guard_team_member_link: NULL -> eu, com meu e-mail)
    SELECT id INTO row_id FROM public.team_members
    WHERE invitation_id = inv.id AND organization_id = inv.organization_id AND user_id IS NULL
    ORDER BY id LIMIT 1;
    IF row_id IS NOT NULL THEN
        UPDATE public.team_members SET user_id = auth.uid(), email = mail WHERE id = row_id;
    ELSE
        -- O placeholder sumiu (inviteMember não confere o erro do insert): cria a linha do time, senão as rotas de
        -- máquina não acham o membro.
        INSERT INTO public.team_members (organization_id, user_id, email, name, role, invitation_id)
        VALUES (inv.organization_id, auth.uid(), mail, split_part(mail, '@', 1), inv.role, inv.id);
    END IF;
    RETURN inv.organization_id;
END;
$$;

-- 6. Permissões: nada para anon. is_org_owner é chamada pelas policies (avaliadas como authenticated).
REVOKE ALL ON FUNCTION public.my_confirmed_email() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_org_owner(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guard_team_member_link() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pending_invitations() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_confirmed_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pending_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid) TO authenticated;

-- 7. Conferência: policies permissivas somam (OR). Qualquer outra policy de escrita que não esteja aqui manteria o buraco
--    aberto, então aborta a transação inteira e lista o que achou.
DO $$
DECLARE
    extra text;
BEGIN
    SELECT string_agg(format('%s: "%s" (%s)', tablename, policyname, cmd), E'\n') INTO extra
    FROM pg_policies
    WHERE schemaname = 'public' AND permissive = 'PERMISSIVE'
      AND (
          (tablename = 'organization_members' AND cmd <> 'SELECT'
              AND policyname NOT IN ('Owners can add themselves', 'Owners can remove members'))
       OR (tablename = 'organizations' AND cmd IN ('INSERT', 'UPDATE', 'ALL')
              AND policyname NOT IN ('Authenticated users can create organizations', 'Owners can update their organizations'))
      );
    IF extra IS NOT NULL THEN
        RAISE EXCEPTION E'policies de escrita desconhecidas (apague/ajuste e rode de novo):\n%', extra;
    END IF;
END $$;

COMMIT;

-- ---------------------------------------------------------------------------------------------------------------------
-- CHECKLIST DE TESTE MANUAL (dois usuários A e B, cada um com a própria org; rode pelo app ou pelo client JS logado)
--   [ ] A cria uma org nova pelo app: funciona (org + organization_members + team_members do A).
--   [ ] B tenta INSERT organization_members (org do A, user_id = B), com ou sem convite: erro de RLS (só pela RPC).
--   [ ] B tenta INSERT organization_members (org do B, user_id = A): erro de RLS (user_id <> auth.uid()).
--   [ ] B tenta INSERT organizations com owner_id = A: erro de RLS.
--   [ ] A convida o e-mail do B: aparece "pendente" na lista do time do A.
--   [ ] B loga: o banner mostra o convite; Aceitar -> a org do A aparece para o B; a linha do time do B fica vinculada
--       (sem "pendente") e select public.pending_invitations() volta vazio.
--   [ ] C (outro e-mail) chama rpc('accept_invitation', {p_invitation_id: <id do convite do B>}): "invitation not found".
--   [ ] A (membro) tenta UPDATE team_members SET user_id = '<uid do B>' numa linha qualquer: erro "only be linked to yourself".
--   [ ] A tenta UPDATE team_members SET email = 'x@y' (ou organization_id = outra org) na linha vinculada do B: erro.
--   [ ] A muda apelido/papel do B e o próprio commit_log em Configurações: salva.
--   [ ] A (dono) remove o B no app: some do time, organization_members do B nessa org é apagado, convite apagado;
--       B não consegue reentrar (INSERT organization_members dá erro de RLS, accept_invitation dá "invitation not found").
-- ---------------------------------------------------------------------------------------------------------------------
