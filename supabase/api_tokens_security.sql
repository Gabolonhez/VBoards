-- =====================================================================================================================
-- Tokens de API: identidade, escopos e expiração (security). Rode no SQL editor do Supabase DEPOIS de api_tokens.sql
-- e ANTES de publicar o código novo (authenticate lê estas colunas). Idempotente. Numa transação (se ficar
-- "current transaction is aborted", rode ROLLBACK;).
--
--   user_id    auth user dono do token, gravado por POST /api/tokens a partir da sessão (getUser). Token sem user_id
--              (criado antes desta mudança) é inválido: o passo 5 revoga esses tokens e o usuário cria outro.
--   scopes     read (GETs) | write (criar/editar tasks e cards, subtarefas sem fila, pedir refine) |
--              agent (rotas agent-tasks do runner local, caixa do Jarvis, subtarefas com queue=true, approve).
--   expires_at opcional (UI: 30/90/365 dias ou nunca; padrão 90). Vencido = 401.
--
-- Rollback (o código novo deixa de autenticar tokens se as colunas sumirem):
--   ALTER TABLE public.api_tokens DROP CONSTRAINT IF EXISTS api_tokens_scopes_valid;
--   DROP INDEX IF EXISTS public.idx_api_tokens_user_id;
--   ALTER TABLE public.api_tokens DROP COLUMN IF EXISTS expires_at, DROP COLUMN IF EXISTS scopes, DROP COLUMN IF EXISTS user_id;
--   (a revogação do passo 5 não se desfaz sozinha: UPDATE public.api_tokens SET revoked_at = NULL WHERE ... se quiser)
-- =====================================================================================================================

BEGIN;

-- 1. Dono = auth user (apagar o usuário apaga os tokens)
ALTER TABLE public.api_tokens ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Escopos (padrão read+write; agent é opt-in na UI)
ALTER TABLE public.api_tokens ADD COLUMN IF NOT EXISTS scopes text[] NOT NULL DEFAULT '{read,write}';
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_tokens_scopes_valid' AND conrelid = 'public.api_tokens'::regclass) THEN
        ALTER TABLE public.api_tokens ADD CONSTRAINT api_tokens_scopes_valid
            CHECK (cardinality(scopes) > 0 AND scopes <@ ARRAY['read', 'write', 'agent']::text[]);
    END IF;
END $$;

-- 3. Expiração opcional
ALTER TABLE public.api_tokens ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 4. Listagem/limite de 20 ativos por usuário
CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON public.api_tokens(user_id) WHERE revoked_at IS NULL;

-- 5. Tokens antigos (identidade por e-mail) ficam revogados: o usuário cria um novo em Configurações → Tokens de API
UPDATE public.api_tokens SET revoked_at = now() WHERE user_id IS NULL AND revoked_at IS NULL;

COMMIT;
