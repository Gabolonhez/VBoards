-- =====================================================================================================================
-- Preflight dos arquivos de segurança. SÓ LEITURA: não cria, não altera, não apaga nada (só consulta pg_catalog e lê
-- as tabelas). Rode no SQL editor do Supabase, como postgres, ANTES de:
--   1. fix_org_members_insert.sql  2. backfill_team_members_user_id.sql  3. schedule_items_requested_by_guard.sql
--   4. api_tokens_security.sql     5. whatsapp_rate_limit.sql
--
-- PARTE 1 (DO): confere cada tabela/coluna/tipo/constraint/policy/função que os 5 arquivos assumem. Se algo faltar ou
--   for diferente, dá RAISE EXCEPTION com a lista do que está errado E o estado atual (policies, colunas, constraints)
--   dessas tabelas. Nesse caso NÃO rode os 5 arquivos: cole de volta a mensagem de erro inteira.
-- PARTE 2 (SELECT, só roda se a PARTE 1 passar): relatório com as policies, triggers, colunas e constraints atuais e
--   avisos sobre os dados (vínculos suspeitos, e-mails não confirmados, o que o backfill vai vincular). Revise os
--   avisos antes de rodar os 5 arquivos.
-- =====================================================================================================================

-- PARTE 1 -------------------------------------------------------------------------------------------------------------
DO $$
DECLARE
    problems text[] := '{}';
    r record;
    rel regclass;
    typ text;
    cat text;
    kind text;
    fmt text;
    ok boolean;
    typ_oid oid;
    tm_role text;
    inv_role text;
    dump text;
BEGIN
    -- 1. Tabelas, RLS ligado, e tabelas que devem ficar sem policy (só service role)
    FOR r IN SELECT * FROM (VALUES
        ('auth.users', false, false),
        ('public.organizations', true, false),
        ('public.organization_members', true, false),
        ('public.organization_invitations', true, false),
        ('public.team_members', true, false),
        ('public.schedule_items', true, false),
        ('public.api_tokens', true, true),
        ('public.whatsapp_messages', true, true),
        ('public.jarvis_inbox', true, true)
    ) AS t(name, needs_rls, no_policies) LOOP
        rel := to_regclass(r.name);
        IF rel IS NULL THEN
            problems := problems || format('tabela %s não existe', r.name);
            CONTINUE;
        END IF;
        IF r.needs_rls AND NOT (SELECT relrowsecurity FROM pg_class WHERE oid = rel) THEN
            problems := problems || format('%s está com RLS DESLIGADO', r.name);
        END IF;
        IF r.no_policies AND EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = rel) THEN
            problems := problems || format('%s deveria ficar sem policies (só service role), mas tem: %s', r.name,
                (SELECT string_agg(polname, ', ') FROM pg_policy WHERE polrelid = rel));
        END IF;
    END LOOP;

    -- 2. Colunas obrigatórias. want: nome do tipo (pg_type.typname), 'S' = qualquer tipo texto, NULL = qualquer tipo
    FOR r IN SELECT * FROM (VALUES
        ('auth.users', 'id', 'uuid'), ('auth.users', 'email', 'S'), ('auth.users', 'email_confirmed_at', NULL),
        ('public.organizations', 'id', 'uuid'), ('public.organizations', 'owner_id', 'uuid'), ('public.organizations', 'name', 'S'),
        ('public.organization_members', 'organization_id', 'uuid'), ('public.organization_members', 'user_id', 'uuid'),
        ('public.organization_members', 'role', NULL),
        ('public.organization_invitations', 'id', 'uuid'), ('public.organization_invitations', 'organization_id', 'uuid'),
        ('public.organization_invitations', 'email', 'S'), ('public.organization_invitations', 'role', NULL),
        ('public.team_members', 'id', 'uuid'), ('public.team_members', 'organization_id', 'uuid'),
        ('public.team_members', 'user_id', 'uuid'), ('public.team_members', 'email', 'S'),
        ('public.team_members', 'invitation_id', 'uuid'), ('public.team_members', 'name', 'S'), ('public.team_members', 'role', NULL),
        ('public.schedule_items', 'organization_id', 'uuid'), ('public.schedule_items', 'subtasks', 'jsonb'),
        ('public.schedule_items', 'refine', 'jsonb'),
        ('public.api_tokens', 'id', 'uuid'), ('public.api_tokens', 'revoked_at', NULL),
        ('public.whatsapp_messages', 'received_at', NULL)
    ) AS t(tbl, col, want) LOOP
        CONTINUE WHEN to_regclass(r.tbl) IS NULL; -- já reportado
        SELECT ty.typname, ty.typcategory INTO typ, cat
        FROM pg_attribute a JOIN pg_type ty ON ty.oid = a.atttypid
        WHERE a.attrelid = to_regclass(r.tbl) AND a.attname = r.col AND a.attnum > 0 AND NOT a.attisdropped;
        IF NOT FOUND THEN
            problems := problems || format('coluna %s.%s não existe', r.tbl, r.col);
        ELSIF r.want = 'S' AND cat <> 'S' THEN
            problems := problems || format('%s.%s é %s, esperado um tipo texto', r.tbl, r.col, typ);
        ELSIF r.want IS NOT NULL AND r.want <> 'S' AND typ <> r.want THEN
            problems := problems || format('%s.%s é %s, esperado %s', r.tbl, r.col, typ, r.want);
        END IF;
    END LOOP;

    -- 3. Colunas que os arquivos 4/5 criam com ADD COLUMN IF NOT EXISTS: se já existem com outro tipo, o ADD é pulado
    --    em silêncio e o código quebra.
    FOR r IN SELECT * FROM (VALUES
        ('public.api_tokens', 'user_id', 'uuid'), ('public.api_tokens', 'scopes', '_text'),
        ('public.api_tokens', 'expires_at', 'timestamptz'),
        ('public.whatsapp_messages', 'sender_jid', 'S'), ('public.whatsapp_messages', 'chat_jid', 'S')
    ) AS t(tbl, col, want) LOOP
        CONTINUE WHEN to_regclass(r.tbl) IS NULL;
        SELECT ty.typname, ty.typcategory INTO typ, cat
        FROM pg_attribute a JOIN pg_type ty ON ty.oid = a.atttypid
        WHERE a.attrelid = to_regclass(r.tbl) AND a.attname = r.col AND a.attnum > 0 AND NOT a.attisdropped;
        IF FOUND AND NOT (typ = r.want OR (r.want = 'S' AND cat = 'S')) THEN
            problems := problems || format('%s.%s já existe como %s (esperado %s)', r.tbl, r.col, typ, r.want);
        END IF;
    END LOOP;
    IF to_regclass('public.api_tokens') IS NOT NULL AND EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'api_tokens_scopes_valid' AND conrelid = to_regclass('public.api_tokens')
          AND pg_get_constraintdef(oid) NOT LIKE '%read%write%agent%') THEN
        problems := problems || 'api_tokens_scopes_valid já existe com outra definição (o arquivo 4 não a recria)';
    END IF;

    -- 4. organization_members.role precisa aceitar 'member' (accept_invitation) e 'owner' (createOrganization)
    rel := to_regclass('public.organization_members');
    IF rel IS NOT NULL THEN
        SELECT ty.oid, ty.typname, ty.typtype, format_type(a.atttypid, a.atttypmod), a.attnum::text INTO typ_oid, typ, kind, fmt, cat
        FROM pg_attribute a JOIN pg_type ty ON ty.oid = a.atttypid
        WHERE a.attrelid = rel AND a.attname = 'role' AND NOT a.attisdropped;
        IF FOUND THEN
            IF kind = 'e' AND (SELECT count(*) FROM pg_enum WHERE enumtypid = typ_oid AND enumlabel IN ('member', 'owner')) < 2 THEN
                problems := problems || format('organization_members.role é o enum %s sem ''member''/''owner'': %s', typ,
                    (SELECT string_agg(enumlabel, ', ') FROM pg_enum WHERE enumtypid = typ_oid));
            END IF;
            FOR r IN SELECT conname, pg_get_expr(conbin, conrelid) AS e FROM pg_constraint
                     WHERE conrelid = rel AND contype = 'c' AND conkey @> ARRAY[cat::smallint] LOOP
                BEGIN
                    EXECUTE format('SELECT bool_and((%s) IS NOT FALSE) FROM (VALUES (%L::%s), (%L::%s)) AS v(role)',
                                   r.e, 'member', fmt, 'owner', fmt) INTO ok;
                    IF NOT ok THEN
                        problems := problems || format('CHECK %s de organization_members recusa ''member'' ou ''owner'': %s', r.conname, r.e);
                    END IF;
                EXCEPTION WHEN OTHERS THEN
                    problems := problems || format('CHECK %s de organization_members (%s) não deu para avaliar: confira se aceita role = ''member''', r.conname, r.e);
                END;
            END LOOP;
        END IF;
    END IF;

    -- 5. accept_invitation copia organization_invitations.role para team_members.role
    SELECT format_type(a.atttypid, a.atttypmod) || ':' || ty.typcategory INTO tm_role
    FROM pg_attribute a JOIN pg_type ty ON ty.oid = a.atttypid
    WHERE a.attrelid = to_regclass('public.team_members') AND a.attname = 'role' AND NOT a.attisdropped;
    SELECT format_type(a.atttypid, a.atttypmod) || ':' || ty.typcategory INTO inv_role
    FROM pg_attribute a JOIN pg_type ty ON ty.oid = a.atttypid
    WHERE a.attrelid = to_regclass('public.organization_invitations') AND a.attname = 'role' AND NOT a.attisdropped;
    IF tm_role IS NOT NULL AND inv_role IS NOT NULL AND tm_role NOT LIKE '%:S' AND tm_role <> inv_role THEN
        problems := problems || format('team_members.role (%s) e organization_invitations.role (%s) têm tipos incompatíveis', tm_role, inv_role);
    END IF;

    -- 6. Funções que os arquivos usam / criam. CREATE OR REPLACE não troca tipo de retorno nem nome de parâmetro.
    IF to_regprocedure('public.check_is_org_member(uuid)') IS NULL THEN
        problems := problems || 'função public.check_is_org_member(uuid) não existe (rls_policies.sql)';
    END IF;
    -- (to_regprocedure e não 'x'::regprocedure: o cast de literal é resolvido no parse e falharia se não existir)
    IF pg_get_function_result(to_regprocedure('public.pending_invitations()')) <> 'TABLE(id uuid, organization_id uuid, organization_name text)' THEN
        problems := problems || format('public.pending_invitations() já existe com outro retorno: %s',
            pg_get_function_result(to_regprocedure('public.pending_invitations()')));
    END IF;
    IF pg_get_function_arguments(to_regprocedure('public.accept_invitation(uuid)')) <> 'p_invitation_id uuid'
       OR pg_get_function_result(to_regprocedure('public.accept_invitation(uuid)')) <> 'uuid' THEN
        problems := problems || 'public.accept_invitation(uuid) já existe com outra assinatura';
    END IF;
    FOR r IN SELECT * FROM (VALUES ('public.my_confirmed_email()', 'text'), ('public.is_org_owner(uuid)', 'boolean'),
                                   ('public.guard_team_member_link()', 'trigger'), ('public.guard_agent_requested_by()', 'trigger')) AS t(sig, ret) LOOP
        IF to_regprocedure(r.sig) IS NOT NULL AND pg_get_function_result(to_regprocedure(r.sig)) <> r.ret THEN
            problems := problems || format('%s já existe retornando %s', r.sig, pg_get_function_result(to_regprocedure(r.sig)));
        END IF;
    END LOOP;

    -- 7. Policies: as permissivas somam (OR). Uma policy de escrita com outro nome manteria o buraco aberto depois do
    --    arquivo 1 (que só dropa pelos nomes do rls_policies.sql).
    SELECT string_agg(format('%s: "%s" (%s) USING %s WITH CHECK %s', tablename, policyname, cmd, coalesce(qual, '-'), coalesce(with_check, '-')), E'\n  ')
    INTO dump
    FROM pg_policies
    WHERE schemaname = 'public' AND permissive = 'PERMISSIVE'
      AND (
          (tablename = 'organization_members' AND cmd <> 'SELECT'
              AND policyname NOT IN ('Authenticated users can join organizations', 'Owners can manage members',
                                     'Owners can add themselves', 'Owners can remove members', 'Users can join as owner or invitee'))
       OR (tablename = 'organizations' AND cmd IN ('INSERT', 'UPDATE', 'ALL')
              AND policyname NOT IN ('Authenticated users can create organizations', 'Owners can update their organizations'))
      );
    IF dump IS NOT NULL THEN
        problems := problems || (E'policies de escrita com nomes desconhecidos (o arquivo 1 não as remove):\n  ' || dump);
    END IF;

    -- 8. As funções SECURITY DEFINER rodam como quem roda os arquivos: precisa passar o RLS e ler auth.users
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND (rolsuper OR rolbypassrls)) THEN
        FOR r IN SELECT c.oid::regclass AS t, c.relforcerowsecurity AS forced, pg_get_userbyid(c.relowner) AS owner
                 FROM pg_class c
                 WHERE c.oid IN (to_regclass('public.organizations'), to_regclass('public.organization_members'),
                                 to_regclass('public.organization_invitations'), to_regclass('public.team_members')) LOOP
            IF r.owner <> current_user OR r.forced THEN
                problems := problems || format('%s não tem BYPASSRLS nem é dono (sem FORCE RLS) de %s: rode os arquivos como postgres', current_user, r.t);
            END IF;
        END LOOP;
    END IF;
    IF to_regclass('auth.users') IS NOT NULL AND NOT has_table_privilege(current_user, 'auth.users', 'SELECT') THEN
        problems := problems || format('%s não lê auth.users', current_user);
    END IF;

    IF cardinality(problems) > 0 THEN
        -- Estado atual para colar de volta junto com o erro
        SELECT string_agg(format('%s: "%s" %s %s roles=%s USING %s WITH CHECK %s', tablename, policyname, permissive, cmd,
                                 roles, coalesce(qual, '-'), coalesce(with_check, '-')), E'\n  ' ORDER BY tablename, policyname)
        INTO dump FROM pg_policies
        WHERE schemaname = 'public' AND tablename IN ('organizations', 'organization_members', 'organization_invitations',
                                                     'team_members', 'schedule_items', 'tasks', 'api_tokens', 'whatsapp_messages');
        problems := problems || (E'POLICIES ATUAIS:\n  ' || coalesce(dump, '(nenhuma)'));
        SELECT string_agg(c.relname || '(' || cols || ')', E'\n  ') INTO dump
        FROM pg_class c
        JOIN LATERAL (SELECT string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod) || CASE WHEN a.attnotnull THEN ' not null' ELSE '' END, ', ' ORDER BY a.attnum) AS cols
                      FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) x ON true
        WHERE c.relnamespace = 'public'::regnamespace
          AND c.relname IN ('organizations', 'organization_members', 'organization_invitations', 'team_members', 'tasks', 'api_tokens', 'whatsapp_messages');
        problems := problems || (E'COLUNAS:\n  ' || coalesce(dump, '(nenhuma)'));
        SELECT string_agg(conrelid::regclass || '.' || conname || ': ' || pg_get_constraintdef(oid), E'\n  ') INTO dump
        FROM pg_constraint
        WHERE contype IN ('c', 'u', 'f', 'p')
          AND conrelid IN (SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace
                           AND relname IN ('organizations', 'organization_members', 'organization_invitations', 'team_members'));
        problems := problems || (E'CONSTRAINTS:\n  ' || coalesce(dump, '(nenhuma)'));
        RAISE EXCEPTION E'PREFLIGHT FALHOU. Nada foi alterado. NÃO rode os 5 arquivos; cole esta mensagem inteira de volta.\n- %',
            array_to_string(problems, E'\n- ');
    END IF;
END $$;

-- PARTE 2 (só chega aqui se a PARTE 1 passou) -------------------------------------------------------------------------
-- section: policy | trigger | column | constraint | definer_function | warning:* (dados a revisar antes de rodar)
WITH tbls(t) AS (VALUES ('organizations'), ('organization_members'), ('organization_invitations'), ('team_members'),
                        ('schedule_items'), ('tasks'), ('api_tokens'), ('whatsapp_messages'))
SELECT 'policy' AS section, tablename || ': ' || policyname AS object,
       format('%s %s roles=%s USING %s WITH CHECK %s', permissive, cmd, roles, coalesce(qual, '-'), coalesce(with_check, '-')) AS detail
FROM pg_policies WHERE schemaname = 'public' AND tablename IN (SELECT t FROM tbls)
UNION ALL
SELECT 'trigger', tgrelid::regclass || ': ' || tgname, pg_get_triggerdef(oid)
FROM pg_trigger WHERE NOT tgisinternal
  AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname IN (SELECT t FROM tbls))
UNION ALL
SELECT 'column', c.relname || '.' || a.attname,
       format_type(a.atttypid, a.atttypmod) || CASE WHEN a.attnotnull THEN ' not null' ELSE '' END
           || coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), '')
FROM pg_class c
JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
WHERE c.relnamespace = 'public'::regnamespace AND c.relname IN ('organizations', 'organization_members', 'organization_invitations', 'team_members', 'tasks')
UNION ALL
SELECT 'constraint', conrelid::regclass || '.' || conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid IN (SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace
                   AND relname IN ('organizations', 'organization_members', 'organization_invitations', 'team_members', 'tasks'))
UNION ALL
SELECT 'definer_function', p.oid::regprocedure::text, coalesce(array_to_string(p.proconfig, ', '), 'SEM search_path FIXO')
FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
UNION ALL
-- Vínculos que a policy antiga de INSERT pode ter deixado entrar: não é dono nem tem convite para o próprio e-mail.
-- Apague à mão os que não reconhecer ANTES do backfill (arquivo 2), que os trataria como prova de vínculo.
SELECT 'warning:suspicious_membership', o.name || ' / ' || coalesce(u.email::text, om.user_id::text),
       format('organization_id=%s user_id=%s role=%s', om.organization_id, om.user_id, om.role)
FROM public.organization_members om
JOIN public.organizations o ON o.id = om.organization_id
LEFT JOIN auth.users u ON u.id = om.user_id
WHERE o.owner_id IS DISTINCT FROM om.user_id
  AND NOT EXISTS (SELECT 1 FROM public.organization_invitations i
                  WHERE i.organization_id = om.organization_id AND lower(i.email::text) = lower(u.email::text))
UNION ALL
-- Sem e-mail confirmado, o guard de team_members e accept_invitation recusam (createOrganization quebra no passo 3)
SELECT 'warning:unconfirmed_email', u.email::text, 'auth.users.email_confirmed_at IS NULL'
FROM auth.users u WHERE u.email IS NOT NULL AND u.email_confirmed_at IS NULL
UNION ALL
SELECT 'warning:owner_without_membership', o.name, format('organization_id=%s owner_id=%s: as rotas de máquina ignoram o dono nesta org', o.id, o.owner_id)
FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = o.id AND om.user_id = o.owner_id)
UNION ALL
SELECT 'warning:backfill_will_link', tm.email::text, format('team_members.id=%s organization_id=%s -> user_id=%s', tm.id, tm.organization_id, u.id)
FROM public.team_members tm
JOIN auth.users u ON lower(u.email::text) = lower(trim(tm.email::text))
JOIN public.organization_members om ON om.organization_id = tm.organization_id AND om.user_id = u.id
WHERE tm.user_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.team_members t2 WHERE t2.organization_id = tm.organization_id AND t2.user_id = u.id)
UNION ALL
SELECT 'warning:linked_without_membership', coalesce(tm.email::text, '-'),
       format('team_members.id=%s organization_id=%s user_id=%s: não conta para as rotas de máquina', tm.id, tm.organization_id, tm.user_id)
FROM public.team_members tm
WHERE tm.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = tm.organization_id AND om.user_id = tm.user_id)
UNION ALL
SELECT 'warning:active_api_tokens', count(*)::text, 'tokens ativos hoje; os sem user_id são revogados pelo arquivo 4 (o usuário cria outro)'
FROM public.api_tokens WHERE revoked_at IS NULL
ORDER BY 1, 2;
