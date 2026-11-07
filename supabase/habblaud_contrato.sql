-- Contrato com o Habblaud: triagem e origem nas tasks, metadados de áudio na caixa do Jarvis e o bucket do áudio.
-- Rode no SQL editor do Supabase ANTES de publicar o código (as rotas leem/gravam estas colunas).
-- stage/prUrl/risk/riskWhy/approvedAt moram dentro do JSONB de schedule_items.subtasks: não precisam de coluna.
-- RLS: nada muda. tasks segue com as policies por organização; jarvis_inbox segue com RLS e SEM policies (só service role).

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS origin text,
    ADD COLUMN IF NOT EXISTS triage jsonb;

DO $$ BEGIN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_origin_check CHECK (origin IS NULL OR origin IN ('research'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.jarvis_inbox
    ADD COLUMN IF NOT EXISTS audio_path text,  -- objeto no bucket jarvis-audio
    ADD COLUMN IF NOT EXISTS audio_mime text,
    ADD COLUMN IF NOT EXISTS audio_bytes integer;

DO $$ BEGIN
    ALTER TABLE public.jarvis_inbox ADD CONSTRAINT jarvis_inbox_audio_check
        CHECK (audio_bytes IS NULL OR (audio_bytes >= 0 AND audio_bytes <= 12582912));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Bucket privado (sem policies em storage.objects: só a service role lê/grava).
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('jarvis-audio', 'jarvis-audio', false, 12582912)
ON CONFLICT (id) DO NOTHING;
