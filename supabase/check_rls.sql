-- =====================================================================
-- DIAGNÓSTICO: quais tabelas do schema public estão SEM RLS?
-- Rode este bloco primeiro no SQL Editor do Supabase para ver o culpado.
-- =====================================================================
SELECT
    c.relname            AS tabela,
    c.relrowsecurity     AS rls_ativo,
    COALESCE(p.qtd_policies, 0) AS qtd_policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN (
    SELECT tablename, count(*) AS qtd_policies
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY tablename
) p ON p.tablename = c.relname
WHERE n.nspname = 'public'
  AND c.relkind = 'r'           -- só tabelas comuns
ORDER BY c.relrowsecurity ASC, c.relname;
-- Linhas com rls_ativo = false são exatamente as que o Supabase está alertando.
-- ATENÇÃO: rls_ativo = true mas qtd_policies = 0 => tabela trancada (nega tudo).
