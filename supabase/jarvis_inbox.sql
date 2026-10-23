-- Caixa de entrada do Jarvis: mensagens do dono no WhatsApp que começam com "Jarvis" (gravadas pelo webhook
-- /api/whatsapp/webhook, lidas por GET /api/v1/jarvis/inbox). Rode no SQL editor do Supabase.
-- RLS ligado e SEM policies: só a service role (rotas do servidor) acessa.
CREATE TABLE IF NOT EXISTS public.jarvis_inbox (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id text UNIQUE,
    owner_email text NOT NULL, -- WHATSAPP_OWNER_EMAIL, em minúsculas
    chat_jid text,
    sender_jid text,
    text text NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now(),
    acked_at timestamptz,
    reply text
);

CREATE INDEX IF NOT EXISTS idx_jarvis_inbox_pending ON public.jarvis_inbox(owner_email, received_at) WHERE acked_at IS NULL;

ALTER TABLE public.jarvis_inbox ENABLE ROW LEVEL SECURITY;
