import { NextResponse } from "next/server";
import { fail, v1Context } from "@/lib/server/integration";
import { dbError, isUuid, mapTask, pickOrg, TASK_STATUSES, validateTaskCreate } from "@/lib/server/v1";

// Kanban tasks (board). Same columns the UI writes in src/lib/api.ts createTask.
export async function GET(req: Request) {
    const ctx = await v1Context(req, "read");
    if (ctx instanceof Response) return ctx;

    const params = new URL(req.url).searchParams;
    const projectId = params.get("projectId");
    const status = params.get("status");
    if (projectId && !isUuid(projectId)) return fail("projectId must be a uuid", 400);
    if (status && !TASK_STATUSES.includes(status as never)) return fail(`status must be ${TASK_STATUSES.join("|")}`, 400);

    let query = ctx.supabase.from("tasks").select("*").in("organization_id", ctx.orgIds);
    if (projectId) query = query.eq("project_id", projectId);
    if (status) query = query.eq("status", status);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(500);
    if (error) return fail(error.message, 500);
    return NextResponse.json({ tasks: (data ?? []).map(mapTask) });
}

export async function POST(req: Request) {
    const ctx = await v1Context(req, "write");
    if (ctx instanceof Response) return ctx;

    const parsed = validateTaskCreate(await req.json().catch(() => null));
    if (!parsed.ok) return fail(parsed.error, 400);
    const { title, description, projectId, status, priority, organizationId } = parsed.value;

    let orgId: string;
    if (projectId) {
        // The project decides the organization; a conflicting organizationId is a client error
        const { data: project, error } = await ctx.supabase.from("projects").select("organization_id").eq("id", projectId).maybeSingle();
        if (error) return fail(error.message, 500);
        if (!project || !ctx.orgIds.includes(project.organization_id)) return fail("project not found", 404);
        if (organizationId && organizationId !== project.organization_id) return fail("projectId does not belong to organizationId", 400);
        orgId = project.organization_id;
    } else {
        const picked = pickOrg(ctx.orgIds, organizationId);
        if ("error" in picked) return fail(picked.error, picked.status);
        orgId = picked.orgId;
    }

    const { data, error } = await ctx.supabase
        .from("tasks")
        .insert({
            organization_id: orgId,
            project_id: projectId ?? null,
            title,
            description: description ?? null,
            status,
            priority,
            code: `TASK-${Math.floor(Math.random() * 10000)}`, // same scheme as createTask in src/lib/api.ts
        })
        .select("*")
        .single();
    if (error) {
        const e = dbError(error); // tasks.project_id may be NOT NULL (the UI always sets one); not visible in supabase/*.sql
        return fail(e.error, e.status);
    }
    return NextResponse.json({ task: mapTask(data) }, { status: 201 });
}
