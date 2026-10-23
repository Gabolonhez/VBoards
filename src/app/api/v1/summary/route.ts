import { NextResponse } from "next/server";
import { todayInBrazil } from "@/lib/utils";
import { fail, v1Context } from "@/lib/server/integration";
import { buildSummary, isDate } from "@/lib/server/v1";

// Counts for Jarvis briefings (agent subtasks, refines, open Kanban columns) across the caller's organizations.
export async function GET(req: Request) {
    const ctx = await v1Context(req, "read");
    if (ctx instanceof Response) return ctx;

    const date = new URL(req.url).searchParams.get("date") || todayInBrazil();
    if (!isDate(date)) return fail("date must be YYYY-MM-DD", 400);

    const [cards, tasks, projects] = await Promise.all([
        ctx.supabase.from("schedule_items").select("id, title, date, subtasks, refine").in("organization_id", ctx.orgIds),
        ctx.supabase
            .from("tasks")
            .select("id, code, title, status, project_id")
            .in("organization_id", ctx.orgIds)
            .in("status", ["ideas", "backlog", "in_progress", "code_review"])
            .order("created_at", { ascending: false }),
        ctx.supabase.from("projects").select("id, name").in("organization_id", ctx.orgIds),
    ]);
    const error = cards.error ?? tasks.error ?? projects.error;
    if (error) return fail(error.message, 500);
    const names = new Map((projects.data ?? []).map((p) => [p.id as string, p.name as string]));
    return NextResponse.json(buildSummary(cards.data ?? [], tasks.data ?? [], names, date));
}
