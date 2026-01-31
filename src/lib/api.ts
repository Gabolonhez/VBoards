import { createClient } from "@/lib/supabase/client";
import { Task, Version, Project, Doc, TaskStatus, TeamMember } from "@/types";

const supabase = createClient();

// Projects
export async function getProjects(): Promise<Project[]> {
    const { data, error } = await supabase.from("projects").select("*").order("name");
    if (error) throw error;
    return data;
}

export async function createProject(project: Partial<Project>): Promise<Project> {
    const { data, error } = await supabase.from("projects").insert({
        name: project.name,
        prefix: project.prefix,
        color: project.color
    }).select().single();
    if (error) throw error;
    return data;
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<void> {
    const { error } = await supabase.from("projects").update(updates).eq("id", id);
    if (error) throw error;
}

export async function deleteProject(id: string): Promise<void> {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) throw error;
}

// Versions
export async function getVersions(): Promise<Version[]> {
    const { data, error } = await supabase.from("versions")
        .select(`
            *,
            owner:team_members(*)
        `)
        .order("created_at", { ascending: false });
    if (error) throw error;

    return data.map(v => ({
        ...v,
        projectId: v.project_id,
        releaseDate: v.release_date,
        ownerId: v.owner_id,
        owner: v.owner ? { ...v.owner, avatarUrl: v.owner.avatar_url } : undefined
    }));
}

export async function createVersion(version: Omit<Version, "id">): Promise<Version> {
    const { data, error } = await supabase.from("versions").insert({
        project_id: version.projectId,
        name: version.name,
        status: version.status,
        release_date: version.releaseDate || null,
        notes: version.notes,
        owner_id: version.ownerId
    }).select().single();

    if (error) throw error;
    return { ...data, projectId: data.project_id, releaseDate: data.release_date, ownerId: data.owner_id };
}

export async function updateVersion(id: string, updates: Partial<Version>): Promise<void> {
    const dbUpdates: any = { ...updates };
    if (updates.projectId !== undefined) dbUpdates.project_id = updates.projectId;
    if (updates.releaseDate !== undefined) dbUpdates.release_date = updates.releaseDate || null;
    if (updates.ownerId !== undefined) dbUpdates.owner_id = updates.ownerId;
    delete dbUpdates.projectId;
    delete dbUpdates.releaseDate;
    delete dbUpdates.ownerId;
    delete dbUpdates.owner;

    const { error } = await supabase.from("versions").update(dbUpdates).eq("id", id);
    if (error) throw error;
}

export async function deleteVersion(id: string): Promise<void> {
    const { error } = await supabase.from("versions").delete().eq("id", id);
    if (error) throw error;
}

// Tasks
export async function getTasks(): Promise<Task[]> {
    const { data, error } = await supabase
        .from("tasks")
        .select(`
      *,
      assignee:team_members(*),
      version:versions(*)
    `)
        .order("created_at", { ascending: false });

    if (error) throw error;

    return data.map(t => ({
        ...t,
        projectId: t.project_id,
        versionId: t.version_id,
        assignee: t.assignee ? { ...t.assignee, avatarUrl: t.assignee.avatar_url } : undefined,
        version: t.version ? { ...t.version, projectId: t.version.project_id, releaseDate: t.version.release_date, ownerId: t.version.owner_id } : undefined
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

    // Remove client-side fields
    delete dbUpdates.projectId;
    delete dbUpdates.versionId;
    delete dbUpdates.assigneeId;
    delete dbUpdates.assignee;

    const { error } = await supabase.from("tasks").update(dbUpdates).eq("id", id);
    if (error) throw error;
}


export async function deleteTask(id: string): Promise<void> {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw error;
}


export async function createTask(task: Partial<Task>): Promise<Task> {
    const { data, error } = await supabase.from("tasks").insert({
        project_id: task.projectId,
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
    return data;
}

// Documents
export async function getDocs(): Promise<Doc[]> {
    const { data, error } = await supabase.from("documents").select("*").order("updated_at", { ascending: false });
    if (error) throw error;
    return data.map(d => ({
        ...d,
        flowDiagramJson: d.flow_data,
        updatedAt: d.updated_at
    }));
}

export async function createDoc(doc: Partial<Doc>): Promise<Doc> {
    const { data, error } = await supabase.from("documents").insert({
        title: doc.title,
        type: doc.type,
        content: doc.content,
        flow_data: doc.flowDiagramJson
    }).select().single();
    if (error) throw error;
    return { ...data, flowDiagramJson: data.flow_data, updatedAt: data.updated_at };
}

export async function updateDoc(id: string, updates: Partial<Doc>): Promise<void> {
    const dbUpdates: any = {};
    if (updates.title) dbUpdates.title = updates.title;
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if (updates.flowDiagramJson !== undefined) dbUpdates.flow_data = updates.flowDiagramJson;
    dbUpdates.updated_at = new Date().toISOString();

    const { error } = await supabase.from("documents").update(dbUpdates).eq("id", id);
    if (error) throw error;
}

export async function deleteDoc(id: string): Promise<void> {
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) throw error;
}

// Team Members
export async function getMembers(): Promise<TeamMember[]> {
    const { data, error } = await supabase.from("team_members").select("*").order("name");
    if (error) throw error;
    return data.map(m => ({
        ...m,
        avatarUrl: m.avatar_url
    }));
}

export async function createMember(member: Partial<TeamMember>): Promise<TeamMember> {
    const { data, error } = await supabase.from("team_members").insert({
        name: member.name,
        nickname: member.nickname,
        role: member.role,
        avatar_url: member.avatarUrl
    }).select().single();
    if (error) throw error;
    return { ...data, avatarUrl: data.avatar_url };
}

export async function deleteMember(id: string): Promise<void> {
    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (error) throw error;
}

// Stats
export async function getDashboardStats() {
    const tasks = await getTasks();
    const versions = await getVersions();
    return { tasks, versions };
}
