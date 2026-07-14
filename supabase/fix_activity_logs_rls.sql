-- =====================================================================
-- FIX: RLS Disabled in Public -> public.activity_logs
-- Rode no SQL Editor do Supabase.
-- =====================================================================

-- PASSO 1 (opcional): ver as colunas da tabela para decidir a policy.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'activity_logs'
ORDER BY ordinal_position;

-- ---------------------------------------------------------------------
-- PASSO 2: ativar RLS. Isso JÁ FECHA o buraco de segurança.
-- A tabela não é lida/escrita pelo app via anon key (não há referência
-- no código), então ativar RLS sem policy = ninguém pelo cliente acessa.
-- O service_role (backend) e funções SECURITY DEFINER continuam funcionando.
-- ---------------------------------------------------------------------
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- PASSO 3 (SÓ se a tabela tiver coluna organization_id E você quiser que
-- membros da org consigam ler/gravar pelo app no futuro). Descomente:
-- ---------------------------------------------------------------------
-- DROP POLICY IF EXISTS "Users can access activity logs" ON public.activity_logs;
-- CREATE POLICY "Users can access activity logs" ON public.activity_logs
-- FOR ALL USING (public.check_is_org_member(organization_id))
-- WITH CHECK (public.check_is_org_member(organization_id));

-- ---------------------------------------------------------------------
-- VERIFICAÇÃO: deve voltar rls_ativo = true
-- ---------------------------------------------------------------------
SELECT relname AS tabela, relrowsecurity AS rls_ativo
FROM pg_class
WHERE oid = 'public.activity_logs'::regclass;
