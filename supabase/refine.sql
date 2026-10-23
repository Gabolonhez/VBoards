-- "Refinar com agente": estado do refinamento no card. Rode no SQL editor do Supabase.
-- Coluna nova numa tabela que ja tem RLS por organizacao (schedule_tables.sql): nenhuma policy muda.
ALTER TABLE public.schedule_items ADD COLUMN IF NOT EXISTS refine jsonb;
