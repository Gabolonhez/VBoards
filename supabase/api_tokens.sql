-- Tokens de API por usuário (Settings → Tokens de API), usados pelo Jarvis/Habblaud e pela API /api/v1.
-- Rode no SQL editor do Supabase. Só o sha256 (hex) do token é guardado.
-- RLS ligado e SEM policies: anon/authenticated não leem nem escrevem; só a service role (rotas do servidor).
CREATE TABLE IF NOT EXISTS public.api_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email text NOT NULL,
    name text NOT NULL,
    token_hash text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz,
    revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_api_tokens_user_email ON public.api_tokens(user_email); -- guardado em minúsculas pelas rotas

ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;
