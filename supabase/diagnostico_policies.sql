-- Diagnóstico SÓ LEITURA: lista as policies, funções e triggers que existem no banco (inclusive as criadas fora do repo).
-- Rode no SQL editor e exporte/cole o resultado inteiro.
SELECT 'policy' AS kind, tablename || ': ' || policyname AS name,
       format('%s %s roles=%s USING %s WITH CHECK %s', permissive, cmd, roles, coalesce(qual, '-'), coalesce(with_check, '-')) AS detail
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('organizations', 'organization_members', 'organization_invitations', 'team_members', 'schedule_items', 'tasks')
UNION ALL
SELECT 'function', p.oid::regprocedure::text,
       CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'invoker' END || E'\n' || pg_get_functiondef(p.oid)
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND (p.prosecdef OR p.proname ILIKE '%invit%' OR p.proname ILIKE '%member%' OR p.proname ILIKE '%org%')
UNION ALL
SELECT 'trigger', tgrelid::regclass || ': ' || tgname, pg_get_triggerdef(oid)
FROM pg_trigger
WHERE NOT tgisinternal
  AND tgrelid IN (SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace
                  AND relname IN ('organizations', 'organization_members', 'organization_invitations', 'team_members', 'schedule_items'))
ORDER BY 1, 2;
