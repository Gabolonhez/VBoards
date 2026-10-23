-- =====================================================================================================================
-- Webhook do WhatsApp: limite por remetente (security). Rode no SQL editor do Supabase DEPOIS de whatsapp.sql e ANTES
-- de publicar o código novo (o webhook grava e conta por sender_jid). Idempotente. Numa transação (se ficar
-- "current transaction is aborted", rode ROLLBACK;). Índice normal (não CONCURRENTLY): a tabela é pequena.
--
-- O webhook conta as linhas de whatsapp_messages do mesmo sender_jid (jid do participante) no último minuto (máx. 10)
-- e no último dia (máx. 100); acima disso responde 200 {ignored:"rate"} sem chamar a IA. Contar no banco porque a rota
-- é serverless (sem estado em memória). Linhas antigas ficam com sender_jid NULL e não contam.
-- message_id passa a ser "chatJid|senderJid|id" (ids do WhatsApp só são únicos por chat/remetente); nada muda no schema.
--
-- Rollback:
--   DROP INDEX IF EXISTS public.idx_whatsapp_messages_sender;
--   ALTER TABLE public.whatsapp_messages DROP COLUMN IF EXISTS sender_jid, DROP COLUMN IF EXISTS chat_jid;
-- =====================================================================================================================

BEGIN;

ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS sender_jid text;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS chat_jid text;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sender ON public.whatsapp_messages(sender_jid, received_at);

COMMIT;
