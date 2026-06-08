-- Cronograma (Schedule) feature
-- Run this in the Supabase SQL editor. Depends on organizations / team_members
-- and the public.check_is_org_member(uuid) helper defined in rls_policies.sql.

-- 1. schedule_items: planning cards per scope (month / week / day)
CREATE TABLE IF NOT EXISTS public.schedule_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    scope text NOT NULL DEFAULT 'month' CHECK (scope IN ('month', 'week', 'day')),
    status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
    title text NOT NULL,
    description text,
    date date,
    assignee_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
    subtasks jsonb NOT NULL DEFAULT '[]'::jsonb,
    position integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_items_org ON public.schedule_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_schedule_items_assignee ON public.schedule_items(assignee_id);

-- 2. schedule_notes: free-text notes per organization + owner (assignee id or 'all')
CREATE TABLE IF NOT EXISTS public.schedule_notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    owner_key text NOT NULL,
    content text,
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, owner_key)
);

CREATE INDEX IF NOT EXISTS idx_schedule_notes_org ON public.schedule_notes(organization_id);

-- 3. RLS
ALTER TABLE public.schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access schedule items" ON public.schedule_items;
CREATE POLICY "Users can access schedule items" ON public.schedule_items
FOR ALL USING (public.check_is_org_member(organization_id))
WITH CHECK (public.check_is_org_member(organization_id));

DROP POLICY IF EXISTS "Users can access schedule notes" ON public.schedule_notes;
CREATE POLICY "Users can access schedule notes" ON public.schedule_notes
FOR ALL USING (public.check_is_org_member(organization_id))
WITH CHECK (public.check_is_org_member(organization_id));
