-- 1. Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;

-- 2. Helper function to check membership without recursion
-- SECURITY DEFINER bypasses RLS, which is necessary to break the infinite loop
CREATE OR REPLACE FUNCTION public.check_is_org_member(org_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = org_id
    AND organization_members.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Organizations Policies
CREATE POLICY "Users can view their organizations" ON organizations
FOR SELECT USING (
  auth.uid() = owner_id OR public.check_is_org_member(id)
);

CREATE POLICY "Authenticated users can create organizations" ON organizations
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can update their organizations" ON organizations
FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their organizations" ON organizations
FOR DELETE USING (auth.uid() = owner_id);

-- 4. Organization Members Policies
CREATE POLICY "Users can view members of their organizations" ON organization_members
FOR SELECT USING (
  user_id = auth.uid() OR public.check_is_org_member(organization_id)
);

CREATE POLICY "Authenticated users can join organizations" ON organization_members
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can manage members" ON organization_members
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM organizations
    WHERE organizations.id = organization_members.organization_id
    AND organizations.owner_id = auth.uid()
  )
);

-- 5. Data Policies (Projects, Team Members, Tasks, Versions, Documents, Invitations)
-- All these use the helper function for simple, non-recursive access control
CREATE POLICY "Users can access projects" ON projects
FOR ALL USING (public.check_is_org_member(organization_id));

CREATE POLICY "Users can access team members" ON team_members
FOR ALL USING (public.check_is_org_member(organization_id));

CREATE POLICY "Users can access tasks" ON tasks
FOR ALL USING (public.check_is_org_member(organization_id));

CREATE POLICY "Users can access versions" ON versions
FOR ALL USING (public.check_is_org_member(organization_id));

CREATE POLICY "Users can access documents" ON documents
FOR ALL USING (public.check_is_org_member(organization_id));

CREATE POLICY "Users can manage invitations" ON organization_invitations
FOR ALL USING (public.check_is_org_member(organization_id));

-- 6. Function and Trigger for claiming data (First user registration)
-- This function runs when the FIRST organization is created
-- It links all existing data (with null organization_id) to that organization
CREATE OR REPLACE FUNCTION public.handle_first_org_claim() 
RETURNS TRIGGER AS $$
DECLARE
    org_count INTEGER;
BEGIN
    SELECT count(*) INTO org_count FROM public.organizations;
    
    -- If this is the first organization ever created
    IF org_count = 1 THEN
        -- Link existing projects
        UPDATE public.projects SET organization_id = NEW.id WHERE organization_id IS NULL;
        -- Link existing tasks
        UPDATE public.tasks SET organization_id = NEW.id WHERE organization_id IS NULL;
        -- Link existing versions
        UPDATE public.versions SET organization_id = NEW.id WHERE organization_id IS NULL;
        -- Link existing team_members
        UPDATE public.team_members SET organization_id = NEW.id WHERE organization_id IS NULL;
        -- Link existing documents
        UPDATE public.documents SET organization_id = NEW.id WHERE organization_id IS NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists for idempotency
DROP TRIGGER IF EXISTS on_organization_created ON public.organizations;

CREATE TRIGGER on_organization_created
    AFTER INSERT ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.handle_first_org_claim();
