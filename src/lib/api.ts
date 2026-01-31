import { createClient } from "@/lib/supabase/client";
import { Task, Version, Project, Doc, TaskStatus, TeamMember, Organization } from "@/types";

const supabase = createClient();

// Projects
export async function getProjects(organizationId?: string): Promise<Project[]> {
    let query = supabase.from("projects").select("*");
    if (organizationId) {
        query = query.eq("organization_id", organizationId);
    }
    const { data, error } = await query.order("name");
    if (error) throw error;
    return data.map(p => ({
        ...p,
        organizationId: p.organization_id,
        createdAt: p.created_at
    }));
}

export async function createProject(project: Partial<Project>, organizationId: string): Promise<Project> {
    const { data, error } = await supabase.from("projects").insert({
        name: project.name,
        prefix: project.prefix,
        color: project.color,
        organization_id: organizationId
    }).select().single();
    if (error) throw error;
    return {
        ...data,
        organizationId: data.organization_id,
        createdAt: data.created_at
    };
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<void> {
    const dbUpdates: any = { ...updates };
    if (updates.organizationId) {
        dbUpdates.organization_id = updates.organizationId;
        delete dbUpdates.organizationId;
    }
    const { error } = await supabase.from("projects").update(dbUpdates).eq("id", id);
    if (error) throw error;
}

export async function deleteProject(id: string): Promise<void> {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw error;
}

// Versions
export async function getVersions(organizationId?: string): Promise<Version[]> {
    let query = supabase.from("versions")
        .select(`
            *,
            owner:team_members(*)
        `);

    if (organizationId) {
        query = query.eq("organization_id", organizationId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;

    return data.map(v => ({
        ...v,
        projectId: v.project_id,
        organizationId: v.organization_id,
        releaseDate: v.release_date,
        ownerId: v.owner_id,
        owner: v.owner ? { ...v.owner, avatarUrl: v.owner.avatar_url, createdAt: v.owner.created_at } : undefined,
        createdAt: v.created_at
    }));
}

export async function createVersion(version: Omit<Version, "id">, organizationId: string): Promise<Version> {
    const { data, error } = await supabase.from("versions").insert({
        project_id: version.projectId,
        organization_id: organizationId,
        name: version.name,
        status: version.status,
        release_date: version.releaseDate || null,
        notes: version.notes,
        owner_id: version.ownerId
    }).select().single();

    if (error) throw error;
    return {
        ...data,
        projectId: data.project_id,
        organizationId: data.organization_id,
        releaseDate: data.release_date,
        ownerId: data.owner_id,
        createdAt: data.created_at
    };
}

export async function updateVersion(id: string, updates: Partial<Version>): Promise<void> {
    const dbUpdates: any = { ...updates };
    if (updates.projectId !== undefined) dbUpdates.project_id = updates.projectId;
    if (updates.releaseDate !== undefined) dbUpdates.release_date = updates.releaseDate || null;
    if (updates.ownerId !== undefined) dbUpdates.owner_id = updates.ownerId;
    if (updates.organizationId !== undefined) dbUpdates.organization_id = updates.organizationId;

    delete dbUpdates.projectId;
    delete dbUpdates.releaseDate;
    delete dbUpdates.ownerId;
    delete dbUpdates.organizationId;
    delete dbUpdates.owner;

    const { error } = await supabase.from("versions").update(dbUpdates).eq("id", id);
    if (error) throw error;
}

export async function deleteVersion(id: string): Promise<void> {
    const { error } = await supabase.from("versions").delete().eq("id", id);
    if (error) throw error;
}

// Tasks
export async function getTasks(organizationId?: string): Promise<Task[]> {
    let query = supabase
        .from("tasks")
        .select(`
      *,
      assignee:team_members(*),
      version:versions(*)
    `);

    if (organizationId) {
        query = query.eq("organization_id", organizationId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw error;

    return data.map(t => ({
        ...t,
        projectId: t.project_id,
        organizationId: t.organization_id,
        versionId: t.version_id,
        assignee: t.assignee ? { ...t.assignee, avatarUrl: t.assignee.avatar_url, createdAt: t.assignee.created_at } : undefined,
        version: t.version ? { ...t.version, projectId: t.version.project_id, organizationId: t.version.organization_id, releaseDate: t.version.release_date, ownerId: t.version.owner_id, createdAt: t.version.created_at } : undefined,
        createdAt: t.created_at,
        updatedAt: t.updated_at
    }));
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", id);
    if (error) throw error;
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<void> {
    const dbUpdates: any = { ...updates };
    if (updates.projectId !== undefined) dbUpdates.project_id = updates.projectId;
    if (updates.versionId !== undefined) dbUpdates.version_id = updates.versionId;
    if (updates.assigneeId !== undefined) dbUpdates.assignee_id = updates.assigneeId;
    if (updates.organizationId !== undefined) dbUpdates.organization_id = updates.organizationId;

    // Remove client-side fields
    delete dbUpdates.projectId;
    delete dbUpdates.versionId;
    delete dbUpdates.assigneeId;
    delete dbUpdates.organizationId;
    delete dbUpdates.assignee;

    const { error } = await supabase.from("tasks").update(dbUpdates).eq("id", id);
    if (error) throw error;
}


export async function deleteTask(id: string): Promise<void> {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw error;
}


export async function createTask(task: Partial<Task>, organizationId: string): Promise<Task> {
    const { data, error } = await supabase.from("tasks").insert({
        project_id: task.projectId,
        organization_id: organizationId,
        version_id: task.versionId === undefined ? undefined : task.versionId,
        title: task.title,
        description: task.description,
        status: task.status,
        images: task.images,
        priority: task.priority,
        type: task.type,
        code: task.code || `TASK-${Math.floor(Math.random() * 10000)}`,
        assignee_id: task.assigneeId === undefined ? undefined : task.assigneeId
    }).select().single();
    if (error) throw error;
    return {
        ...data,
        projectId: data.project_id,
        organizationId: data.organization_id,
        versionId: data.version_id,
        assigneeId: data.assignee_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at
    };
}

// Documents
export async function getDocs(organizationId?: string): Promise<Doc[]> {
    let query = supabase.from("documents").select("*");
    if (organizationId) {
        query = query.eq("organization_id", organizationId);
    }
    const { data, error } = await query.order("updated_at", { ascending: false });
    if (error) throw error;
    return data.map(d => ({
        ...d,
        organizationId: d.organization_id,
        flowDiagramJson: d.flow_data,
        updatedAt: d.updated_at,
        createdAt: d.created_at
    }));
}

export async function createDoc(doc: Partial<Doc>, organizationId: string): Promise<Doc> {
    const { data, error } = await supabase.from("documents").insert({
        title: doc.title,
        type: doc.type,
        content: doc.content,
        organization_id: organizationId,
        flow_data: doc.flowDiagramJson
    }).select().single();
    if (error) throw error;
    return {
        ...data,
        organizationId: data.organization_id,
        flowDiagramJson: data.flow_data,
        updatedAt: data.updated_at,
        createdAt: data.created_at
    };
}

export async function updateDoc(id: string, updates: Partial<Doc>): Promise<void> {
    const dbUpdates: any = {};
    if (updates.title) dbUpdates.title = updates.title;
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if (updates.flowDiagramJson !== undefined) dbUpdates.flow_data = updates.flowDiagramJson;
    if (updates.organizationId !== undefined) dbUpdates.organization_id = updates.organizationId;
    dbUpdates.updated_at = new Date().toISOString();

    const { error } = await supabase.from("documents").update(dbUpdates).eq("id", id);
    if (error) throw error;
}

export async function deleteDoc(id: string): Promise<void> {
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) throw error;
}

// Team Members
export async function getMembers(organizationId?: string): Promise<TeamMember[]> {
    let query = supabase.from("team_members").select("*");
    if (organizationId) {
        query = query.eq("organization_id", organizationId);
    }
    const { data, error } = await query.order("name");
    if (error) throw error;
    return data.map(m => ({
        ...m,
        organizationId: m.organization_id,
        avatarUrl: m.avatar_url,
        createdAt: m.created_at,
        userId: m.user_id,
        email: m.email,
        invitationId: m.invitation_id
    }));
}

export async function createMember(member: Partial<TeamMember>, organizationId: string): Promise<TeamMember> {
    const { data, error } = await supabase.from("team_members").insert({
        name: member.name,
        nickname: member.nickname,
        role: member.role,
        organization_id: organizationId,
        avatar_url: member.avatarUrl
    }).select().single();
    if (error) throw error;
    return {
        ...data,
        organizationId: data.organization_id,
        avatarUrl: data.avatar_url,
        createdAt: data.created_at
    };
}

export async function updateMember(id: string, updates: Partial<TeamMember>): Promise<void> {
    const dbUpdates: any = { ...updates };

    // Map client-side camelCase to DB snake_case
    if (updates.avatarUrl !== undefined) {
        dbUpdates.avatar_url = updates.avatarUrl;
        delete dbUpdates.avatarUrl;
    }

    // Remove fields that shouldn't be updated directly or are read-only
    delete dbUpdates.id;
    delete dbUpdates.createdAt;
    delete dbUpdates.organizationId;
    delete dbUpdates.userId;
    delete dbUpdates.email;
    delete dbUpdates.invitationId;

    const { error } = await supabase.from("team_members").update(dbUpdates).eq("id", id);
    if (error) throw error;
}

export async function deleteMember(id: string): Promise<void> {
    // 1. Get member details to find invitation_id and user_id
    const { data: member } = await supabase.from("team_members").select("invitation_id, user_id, organization_id").eq("id", id).single();

    // 2. Delete team member (this will now set null on tasks thanks to new constraints)
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (error) throw error;

    if (member) {
        // 3. Revoke access (delete from organization_members)
        if (member.user_id) {
            await supabase.from("organization_members")
                .delete()
                .eq("organization_id", member.organization_id)
                .eq("user_id", member.user_id);
        }

        // 4. Delete invitation (if it exists)
        if (member.invitation_id) {
            await supabase.from("organization_invitations")
                .delete()
                .eq("id", member.invitation_id);
        }
    }
}

// Organizations
export async function getOrganizations(): Promise<Organization[]> {
    const { data, error } = await supabase.from("organizations").select("*").order("name");
    if (error) throw error;
    return data.map(org => ({
        ...org,
        ownerId: org.owner_id,
        createdAt: org.created_at
    }));
}

export async function createOrganization(name: string): Promise<Organization> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    // 1. Create organization
    const { data: org, error: orgError } = await supabase.from("organizations").insert({
        name,
        owner_id: user.id
    }).select().single();

    if (orgError) throw orgError;

    // 2. Add creator as owner member in permissions table
    const { error: memberError } = await supabase.from("organization_members").insert({
        organization_id: org.id,
        user_id: user.id,
        role: 'owner'
    });

    if (memberError) throw memberError;

    // 3. Add creator as displayable team member
    const { error: teamMemberError } = await supabase.from("team_members").insert({
        organization_id: org.id,
        user_id: user.id, // Link to auth user
        name: user.user_metadata.full_name || user.email?.split('@')[0] || "Owner",
        role: 'admin', // Use admin role for UI
        email: user.email,
        avatar_url: user.user_metadata.avatar_url
    });

    if (teamMemberError) throw teamMemberError;

    return {
        ...org,
        ownerId: org.owner_id,
        createdAt: org.created_at
    };
}

export async function updateOrganization(id: string, name: string): Promise<void> {
    const { error } = await supabase.from("organizations").update({ name }).eq("id", id);
    if (error) throw error;
}

export async function deleteOrganization(id: string): Promise<void> {
    const { error } = await supabase.rpc("soft_delete_organization", { target_org_id: id });
    if (error) throw error;
}

export async function inviteMember(email: string, role: string, organizationId: string): Promise<void> {
    // 1. Create invitation record
    const { data: invite, error: inviteError } = await supabase.from("organization_invitations").insert({
        organization_id: organizationId,
        email,
        role,
    }).select().single();

    if (inviteError) {
        // If unique constraint violation (already invited), just return (or throw)
        if (inviteError.code === '23505') throw new Error("Member already invited");
        throw inviteError;
    }

    // 2. Create placeholder team member for display
    // Check if member already exists with this email to avoid duplicates
    const { data: existing } = await supabase.from("team_members")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("email", email)
        .single();

    if (!existing) {
        await supabase.from("team_members").insert({
            name: email.split('@')[0], // Default name from email
            role: role,
            email: email,
            organization_id: organizationId,
            invitation_id: invite.id
        });
    } else {
        // Link existing member if they were unlinked?
        await supabase.from("team_members").update({
            invitation_id: invite.id
        }).eq("id", existing.id);
    }
}

// Stats
export async function getDashboardStats(organizationId: string): Promise<{ tasks: Task[], versions: Version[] }> {
    const [tasks, versions] = await Promise.all([
        getTasks(organizationId),
        getVersions(organizationId)
    ]);
    return { tasks, versions };
}
