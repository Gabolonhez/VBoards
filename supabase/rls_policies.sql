-- 1. Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 2. Organizations Policies
-- Allow users to see organizations they are members of
CREATE POLICY "Users can view their organizations" ON organizations
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.organization_id = organizations.id
    AND organization_members.user_id = auth.uid()
  )
);

-- 3. Organization Members Policies
-- Allow users to see other members of their organizations
CREATE POLICY "Users can view members of their organizations" ON organization_members
FOR SELECT USING (
  organization_id IN (
    SELECT org_id FROM (
      SELECT organization_id as org_id FROM organization_members
      WHERE user_id = auth.uid()
    ) as user_orgs
  )
);

-- 4. Projects Policies
CREATE POLICY "Users can view projects in their organizations" ON projects
FOR SELECT USING (
  organization_id IN (
    SELECT org_id FROM (
      SELECT organization_id as org_id FROM organization_members
      WHERE user_id = auth.uid()
    ) as user_orgs
  )
);

CREATE POLICY "Users can insert projects in their organizations" ON projects
FOR INSERT WITH CHECK (
  organization_id IN (
    SELECT org_id FROM (
      SELECT organization_id as org_id FROM organization_members
      WHERE user_id = auth.uid()
    ) as user_orgs
  )
);

CREATE POLICY "Users can update projects in their organizations" ON projects
FOR UPDATE USING (
  organization_id IN (
    SELECT org_id FROM (
      SELECT organization_id as org_id FROM organization_members
      WHERE user_id = auth.uid()
    ) as user_orgs
  )
);

CREATE POLICY "Users can delete projects in their organizations" ON projects
FOR DELETE USING (
  organization_id IN (
    SELECT org_id FROM (
      SELECT organization_id as org_id FROM organization_members
      WHERE user_id = auth.uid()
    ) as user_orgs
  )
);

-- 5. Team Members Policies
CREATE POLICY "Users can view team members in their organizations" ON team_members
FOR SELECT USING (
  organization_id IN (
    SELECT org_id FROM (
      SELECT organization_id as org_id FROM organization_members
      WHERE user_id = auth.uid()
    ) as user_orgs
  )
);

CREATE POLICY "Users can manage team members in their organizations" ON team_members
FOR ALL USING (
  organization_id IN (
    SELECT org_id FROM (
      SELECT organization_id as org_id FROM organization_members
      WHERE user_id = auth.uid()
    ) as user_orgs
  )
);

-- 6. Tasks Policies
CREATE POLICY "Users can access tasks in their organizations" ON tasks
FOR ALL USING (
  organization_id IN (
    SELECT org_id FROM (
      SELECT organization_id as org_id FROM organization_members
      WHERE user_id = auth.uid()
    ) as user_orgs
  )
);

-- 7. Versions Policies
CREATE POLICY "Users can access versions in their organizations" ON versions
FOR ALL USING (
  organization_id IN (
    SELECT org_id FROM (
      SELECT organization_id as org_id FROM organization_members
      WHERE user_id = auth.uid()
    ) as user_orgs
  )
);

-- 8. Documents Policies
CREATE POLICY "Users can access documents in their organizations" ON documents
FOR ALL USING (
  organization_id IN (
    SELECT org_id FROM (
      SELECT organization_id as org_id FROM organization_members
      WHERE user_id = auth.uid()
) as user_orgs
  )
);

-- 9. Function and Trigger for claiming data (First user registration)
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

CREATE TRIGGER on_organization_created
    AFTER INSERT ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.handle_first_org_claim();
