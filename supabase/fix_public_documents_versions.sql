-- =====================================================================================================================
-- Fecha o acesso público a documents, versions e profiles (segurança). Rode no SQL editor do Supabase, como postgres,
-- depois do fix_public_tasks.sql. Idempotente e numa transação: se algo falhar, nada muda (rode ROLLBACK; se o editor
-- ficar em "current transaction is aborted"). Não apaga nenhum dado.
--
-- Problema: policies criadas fora do repo com USING/WITH CHECK true para o papel public:
--   documents: "Public documents view/insert/update/delete"  -> qualquer pessoa, sem login, lê/cria/altera/apaga
--   versions:  "Public versions view/insert/update/delete"   -> idem
--   profiles:  "Public profiles" (SELECT)                    -> qualquer pessoa, sem login, lê os perfis
-- O app só usa documents/versions logado e filtrando por organization_id (src/lib/api.ts); profiles não é usada.
--
-- Passos:
--   1. versions sem organization_id herdam a do projeto.
--   2. Se sobrar documents/versions sem organização, aborta e não muda nada (sumiriam da tela).
--   3. Garante as policies de membro "Users can access versions/documents" (rls_policies.sql), com WITH CHECK.
--   4. Remove as policies públicas; profiles passa a ser lida só por quem está logado.
--
-- Rollback (volta ao estado INSEGURO):
--   CREATE POLICY "Public documents view" ON public.documents FOR SELECT USING (true);
--   CREATE POLICY "Public documents insert" ON public.documents FOR INSERT WITH CHECK (true);
--   CREATE POLICY "Public documents update" ON public.documents FOR UPDATE USING (true);
--   CREATE POLICY "Public documents delete" ON public.documents FOR DELETE USING (true);
--   (o mesmo para versions) e:
--   DROP POLICY "Public profiles" ON public.profiles; CREATE POLICY "Public profiles" ON public.profiles FOR SELECT USING (true);
-- =====================================================================================================================

BEGIN;

-- 1. versions.organization_id a partir do projeto
DO $$
DECLARE
    fixed int := 0;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'organization_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'versions' AND column_name = 'project_id') THEN
        UPDATE public.versions v SET organization_id = p.organization_id
        FROM public.projects p
        WHERE v.project_id = p.id AND v.organization_id IS NULL AND p.organization_id IS NOT NULL;
        GET DIAGNOSTICS fixed = ROW_COUNT;
    END IF;
    RAISE NOTICE 'versions que receberam organization_id do projeto: %', fixed;
END $$;

-- 2. Nada pode ficar sem organização
DO $$
DECLARE
    orphan_versions int;
    orphan_docs int;
BEGIN
    SELECT count(*) INTO orphan_versions FROM public.versions WHERE organization_id IS NULL;
    SELECT count(*) INTO orphan_docs FROM public.documents WHERE organization_id IS NULL;
    IF orphan_versions > 0 OR orphan_docs > 0 THEN
        RAISE EXCEPTION 'há % version(s) e % document(s) sem organization_id: sumiriam da tela. Nada foi alterado; me mande esta mensagem.',
            orphan_versions, orphan_docs;
    END IF;
END $$;

-- 3. Policies de membro (cria só se não existirem com esse nome)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'versions' AND policyname = 'Users can access versions') THEN
        CREATE POLICY "Users can access versions" ON public.versions FOR ALL TO authenticated
            USING (public.check_is_org_member(organization_id)) WITH CHECK (public.check_is_org_member(organization_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'documents' AND policyname = 'Users can access documents') THEN
        CREATE POLICY "Users can access documents" ON public.documents FOR ALL TO authenticated
            USING (public.check_is_org_member(organization_id)) WITH CHECK (public.check_is_org_member(organization_id));
    END IF;
END $$;
ALTER TABLE public.versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 4. Remove o acesso público
DROP POLICY IF EXISTS "Public documents view" ON public.documents;
DROP POLICY IF EXISTS "Public documents insert" ON public.documents;
DROP POLICY IF EXISTS "Public documents update" ON public.documents;
DROP POLICY IF EXISTS "Public documents delete" ON public.documents;
DROP POLICY IF EXISTS "Public versions view" ON public.versions;
DROP POLICY IF EXISTS "Public versions insert" ON public.versions;
DROP POLICY IF EXISTS "Public versions update" ON public.versions;
DROP POLICY IF EXISTS "Public versions delete" ON public.versions;

DROP POLICY IF EXISTS "Public profiles" ON public.profiles;
CREATE POLICY "Public profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

COMMIT;

-- 5. Relatório: o que ainda está aberto para quem não está logado (deve voltar vazio)
SELECT tablename, policyname, cmd, roles::text, coalesce(qual, '-') AS using_expr, coalesce(with_check, '-') AS with_check_expr
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual = 'true' OR with_check = 'true')
  AND NOT (roles = '{authenticated}')
ORDER BY tablename, policyname;
