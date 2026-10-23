import { NextResponse } from "next/server";
import { fail, scopedRow, v1Context } from "@/lib/server/integration";
import { dbError, mapTask, validateTaskPatch } from "@/lib/server/v1";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await v1Context(req, "write");
    if (ctx instanceof Response) return ctx;

    const parsed = validateTaskPatch(await req.json().catch(() => null));
    if (!parsed.ok) return fail(parsed.error, 400);
    const task = await scopedRow(ctx, "tasks", (await params).id);
    if (task instanceof Response) return task;

    const { title, description, status, priority, projectId } = parsed.value;
    if (projectId) {
        const { data: project, error } = await ctx.supabase.from("projects").select("organization_id").eq("id", projectId).maybeSingle();
        if (error) return fail(error.message, 500);
        if (!project || project.organization_id !== task.organization_id) return fail("project not found", 404);
    }
    const update: Record<string, unknown> = { title, description, status, priority, project_id: projectId };
    Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);

    const { data, error } = await ctx.supabase.from("tasks").update(update).eq("id", task.id).select("*").single();
    if (error) {
        const e = dbError(error); // projectId: null on a NOT NULL column -> 400
        return fail(e.error, e.status);
    }
    return NextResponse.json({ task: mapTask(data) });
}
