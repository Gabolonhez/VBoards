-- Webhook do WhatsApp (gateway WA-AKG): dedup por id da mensagem e o card (task) criado a partir dela.
-- Rode no SQL editor do Supabase. RLS ligado e SEM policies: só a service role (a rota do webhook) acessa.
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    message_id text PRIMARY KEY,
    received_at timestamptz NOT NULL DEFAULT now(),
    task_id text -- tasks.id do card criado (sem FK: apagar o card não precisa mexer aqui)
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
