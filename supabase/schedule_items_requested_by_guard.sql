-- =====================================================================================================================
-- Guard do requestedBy no Planning (security). Rode no SQL editor do Supabase DEPOIS de schedule_tables.sql, refine.sql
-- e fix_org_members_insert.sql. Idempotente. Numa transação (se ficar "current transaction is aborted", rode ROLLBACK;).
--
-- Problema: o runner local (GET /api/agent-tasks) executa no computador do usuário toda subtarefa com
-- agent.status = 'queued' e agent.requestedBy = um team_members.id dele. A policy de schedule_items deixa qualquer membro
-- da org escrever o JSONB, então um colega podia enfileirar trabalho em nome de outro (requestedBy = id da vítima).
--
-- Regra: em requisições de cliente (auth.uid() não nulo; a service role das rotas do servidor passa direto, e essas
-- rotas já gravam requestedBy = o membro do próprio token), toda subtarefa com agent.status = 'queued' que é nova ou
-- mudou em relação ao OLD (mesmo id) precisa ter agent.requestedBy = um team_members.id com user_id = auth.uid() na org
-- da linha. Mesma regra para NEW.refine com status 'queued' que mudou. Senão: RAISE EXCEPTION (o update inteiro falha).
-- Comparação jsonb = jsonb é semântica (ordem das chaves não importa). Custo: O(n) por update que mexe em subtasks.
--
-- Efeitos colaterais conhecidos (intencionais): editar (texto, done...) uma subtarefa ainda 'queued' de OUTRA pessoa
-- falha (trocar o texto de uma tarefa enfileirada da vítima é o mesmo ataque); um save com estado velho que "volta" a
-- subtarefa de outra pessoa de running/review para queued também falha (a UI mostra erro e recarrega). Apagar a
-- subtarefa, ou editar as que não estão 'queued', continua livre.
--
-- Rollback:
--   DROP TRIGGER IF EXISTS guard_agent_requested_by ON public.schedule_items;
--   DROP FUNCTION IF EXISTS public.guard_agent_requested_by();
-- =====================================================================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_agent_requested_by()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    mine text[];               -- meus team_members.id nesta org (texto, para comparar com o JSONB)
    old_by_id jsonb := '{}';   -- subtarefas do OLD indexadas por id (um passe só, em vez de varrer o OLD por subtarefa)
    sub jsonb;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW; -- service role (rotas do servidor) / SQL editor
    END IF;
    -- Caminho rápido: a maioria dos updates (status, título, posição, data) não mexe em subtasks nem refine
    IF TG_OP = 'UPDATE' AND NEW.subtasks IS NOT DISTINCT FROM OLD.subtasks AND NEW.refine IS NOT DISTINCT FROM OLD.refine THEN
        RETURN NEW;
    END IF;

    SELECT coalesce(array_agg(id::text), '{}') INTO mine
    FROM public.team_members
    WHERE organization_id = NEW.organization_id AND user_id = auth.uid();

    IF TG_OP = 'UPDATE' AND jsonb_typeof(OLD.subtasks) = 'array' THEN
        SELECT coalesce(jsonb_object_agg(value->>'id', value), '{}') INTO old_by_id
        FROM jsonb_array_elements(OLD.subtasks)
        WHERE value->>'id' IS NOT NULL; -- jsonb_object_agg não aceita chave nula
    END IF;

    IF jsonb_typeof(NEW.subtasks) = 'array' THEN
        FOR sub IN SELECT value FROM jsonb_array_elements(NEW.subtasks) LOOP
            CONTINUE WHEN sub #>> '{agent,status}' IS DISTINCT FROM 'queued';
            -- igual ao que já estava: não é desta requisição (sem id => sempre conferida)
            CONTINUE WHEN sub->>'id' IS NOT NULL AND old_by_id -> (sub->>'id') = sub;
            -- coalesce: requestedBy ausente/nulo também é recusado
            IF NOT coalesce(sub #>> '{agent,requestedBy}' = ANY (mine), false) THEN
                RAISE EXCEPTION 'subtask % can only be queued for the agent by its requester (agent.requestedBy must be your team member id)', sub->>'id'
                    USING ERRCODE = '42501';
            END IF;
        END LOOP;
    END IF;

    IF NEW.refine->>'status' = 'queued'
       AND (TG_OP = 'INSERT' OR NEW.refine IS DISTINCT FROM OLD.refine)
       AND NOT coalesce(NEW.refine->>'requestedBy' = ANY (mine), false) THEN
        RAISE EXCEPTION 'refine can only be queued as yourself (refine.requestedBy must be your team member id)' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_agent_requested_by() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_agent_requested_by ON public.schedule_items;
CREATE TRIGGER guard_agent_requested_by
    BEFORE INSERT OR UPDATE ON public.schedule_items
    FOR EACH ROW EXECUTE FUNCTION public.guard_agent_requested_by();

COMMIT;

-- ---------------------------------------------------------------------------------------------------------------------
-- CHECKLIST DE TESTE MANUAL (A e B membros da mesma org; mA/mB = team_members.id de cada um; pelo client JS logado)
--   [ ] A, pelo app, "Enviar ao agente" numa subtarefa: salva (requestedBy = mA).
--   [ ] A, pelo app, "Refinar com agente" e depois "Aprovar": salvam.
--   [ ] A faz update de subtasks com uma subtarefa nova {agent:{status:'queued', requestedBy: mB}}: erro 42501.
--   [ ] A troca o texto de uma subtarefa 'queued' do B: erro 42501.
--   [ ] A muda uma subtarefa 'review' do B de volta para 'queued' (requestedBy mB): erro 42501.
--   [ ] A faz update de refine = {status:'queued', requestedBy: mB}: erro 42501.
--   [ ] A muda título/status/data de um card que tem subtarefa 'queued' do B (sem tocar subtasks): salva.
--   [ ] A adiciona, marca como feita ou reordena uma subtarefa comum num card com subtarefa 'queued' do B: salva.
--   [ ] A apaga a subtarefa 'queued' do B: salva.
--   [ ] Runner/rotas do servidor (service role) atualizando agent.status para running/done: salva.
-- ---------------------------------------------------------------------------------------------------------------------
