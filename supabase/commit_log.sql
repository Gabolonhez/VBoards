-- Per-member opt-out for the git post-commit hook (src/app/api/commits/route.ts). Default ON.
-- No new RLS needed: "Users can access team members" is FOR ALL, so org members can update the row.
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS commit_log boolean NOT NULL DEFAULT true;
