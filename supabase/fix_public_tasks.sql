-- =====================================================================================================================
-- Fecha o acesso público à tabela tasks (segurança). Rode no SQL editor do Supabase, como postgres, depois do
-- fix_org_members_insert.sql. Idempotente e numa transação: se algo falhar, nada muda (rode ROLLBACK; se o editor ficar
-- em "current transaction is aborted").
--
-- Problema: o banco tem as policies "Public tasks view/insert/update/delete" (criadas fora do repo) com USING/WITH
-- CHECK true para o papel public, ou seja, QUALQUER pessoa, mesmo sem login, com a chave anon (que vai no front) lê,
-- cria, altera e apaga as tarefas de todas as organizações. O app só acessa tasks logado, e para isso já existe
-- "Users can access tasks" (check_is_org_member(organization_id)), que continua.
--
-- Passos:
--   1. Tarefas sem organization_id herdam a do projeto (senão sumiriam da tela ao tirar as policies públicas).
--   2. Se ainda sobrar tarefa sem organização, aborta e não muda nada (mostra quantas).
--   3. Remove as 4 policies públicas.
--   4. Depois do COMMIT, lista qualquer outra policy do schema public ainda aberta (USING/WITH CHECK true) para revisão.
--
-- Não apaga nenhum dado. Rollback (volta ao estado INSEGURO):
--   CREATE POLICY "Public tasks view" ON public.tasks FOR SELECT USING (true);
--   CREATE POLICY "Public tasks insert" ON public.tasks FOR INSERT WITH CHECK (true);
--   CREATE POLICY "Public tasks update" ON public.tasks FOR UPDATE USING (true);
--   CREATE POLICY "Public tasks delete" ON public.tasks FOR DELETE USING (true);
-- =====================================================================================================================

BEGIN;

-- 1. organization_id a partir do projeto (só se projects tiver a coluna)
DO $$
DECLARE
    fixed int := 0;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'organization_id') THEN
        UPDATE public.tasks t SET organization_id = p.organization_id
        FROM public.projects p
        WHERE t.project_id = p.id AND t.organization_id IS NULL AND p.organization_id IS NOT NULL;
        GET DIAGNOSTICS fixed = ROW_COUNT;
    END IF;
    RAISE NOTICE 'tarefas que receberam organization_id do projeto: %', fixed;
END $$;

-- 2. Nenhuma tarefa pode ficar sem organização
DO $$
DECLARE
    orphans int;
BEGIN
    SELECT count(*) INTO orphans FROM public.tasks WHERE organization_id IS NULL;
    IF orphans > 0 THEN
        RAISE EXCEPTION 'ainda há % tarefa(s) sem organization_id (nem o projeto tem): elas sumiriam da tela. Nada foi alterado; me mande esta mensagem.', orphans;
    END IF;
END $$;

-- 3. Remove o acesso público
DROP POLICY IF EXISTS "Public tasks view" ON public.tasks;
DROP POLICY IF EXISTS "Public tasks insert" ON public.tasks;
DROP POLICY IF EXISTS "Public tasks update" ON public.tasks;
DROP POLICY IF EXISTS "Public tasks delete" ON public.tasks;

COMMIT;

-- 4. Relatório: outras policies ainda abertas no schema public (revisar; nenhuma é alterada aqui)
SELECT tablename, policyname, cmd, roles::text, coalesce(qual, '-') AS using_expr, coalesce(with_check, '-') AS with_check_expr
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual = 'true' OR with_check = 'true')
ORDER BY tablename, policyname;
