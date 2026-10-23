-- =====================================================================================================================
-- Backfill de team_members.user_id (security). Rode no SQL editor do Supabase DEPOIS de fix_org_members_insert.sql.
-- Idempotente (rodar de novo não muda nada). Numa transação: se algo falhar, nada muda (se ficar "current transaction
-- is aborted", rode ROLLBACK;). Rode como postgres (SQL editor), nunca "impersonando" um usuário: o guard de
-- team_members só deixa passar quando auth.uid() é NULL.
--
-- Por quê: a identidade das rotas de máquina (/api/agent-tasks, /api/v1) agora é o auth user id, não o e-mail. Só
-- contam linhas de team_members com user_id = o usuário E organization_members (org, usuário). O app nunca aceitava
-- convites, então pode haver linhas de pessoas que de fato estão na org (organization_members existe) mas sem user_id.
--
-- Regra (conservadora): vincula uma linha sem user_id SÓ quando já existe organization_members com a mesma org e o auth
-- user cujo e-mail é o da linha, e o usuário ainda não tem outra linha vinculada nessa org (se houver várias linhas
-- candidatas na mesma org, vincula só uma). Uma linha só com e-mail (o placeholder de convite que qualquer membro
-- cria) nunca é suficiente sozinha.
-- ANTES: revise a seção "suspicious_membership" do 00_preflight_security.sql. Um organization_members forjado pela
-- policy antiga seria aceito aqui como prova; apague esses vínculos primeiro.
-- Também normaliza o e-mail das linhas vinculadas para o e-mail do auth user (o caminho legado COMMIT_HOOK_SECRET +
-- email compara exato, em minúsculas).
--
-- Rollback: o passo 1 guarda id/user_id/email em backup.team_members_20261023 (schema fora da API; só a primeira
-- execução grava). Para desfazer (desvincula também quem aceitou convite depois do backup):
--   UPDATE public.team_members t SET user_id = b.user_id, email = b.email
--   FROM backup.team_members_20261023 b WHERE b.id = t.id;
-- =====================================================================================================================

BEGIN;

-- 1. Backup (uma vez; schema "backup" não é exposto pelo PostgREST e anon/authenticated não têm USAGE nele)
CREATE SCHEMA IF NOT EXISTS backup;
CREATE TABLE IF NOT EXISTS backup.team_members_20261023 AS
    SELECT id, user_id, email FROM public.team_members;

-- 2. Vincula (uma linha por org+usuário; o NOT EXISTS sozinho não impede duas no mesmo UPDATE)
WITH candidates AS (
    SELECT DISTINCT ON (tm.organization_id, u.id) tm.id, u.id AS uid, lower(u.email::text) AS mail
    FROM public.team_members tm
    JOIN auth.users u ON lower(u.email::text) = lower(trim(tm.email::text))
    JOIN public.organization_members om ON om.organization_id = tm.organization_id AND om.user_id = u.id
    WHERE tm.user_id IS NULL
      AND u.email IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.team_members t2 WHERE t2.organization_id = tm.organization_id AND t2.user_id = u.id)
    ORDER BY tm.organization_id, u.id, tm.id
)
UPDATE public.team_members tm
SET user_id = c.uid, email = c.mail
FROM candidates c
WHERE tm.id = c.id;

-- 3. E-mail das linhas vinculadas = e-mail do auth user (usuário sem e-mail, ex. telefone: não mexe)
UPDATE public.team_members tm
SET email = lower(u.email::text)
FROM auth.users u
WHERE tm.user_id = u.id AND u.email IS NOT NULL AND tm.email::text IS DISTINCT FROM lower(u.email::text);

-- 4. Conferência: linhas vinculadas cujo usuário NÃO está em organization_members da org (não contam para as rotas;
--    revise: ou falta o organization_members, ou o vínculo foi forjado)
SELECT tm.id, tm.organization_id, tm.user_id, tm.email
FROM public.team_members tm
WHERE tm.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.organization_members om WHERE om.organization_id = tm.organization_id AND om.user_id = tm.user_id);

COMMIT;
