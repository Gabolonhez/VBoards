import { NextResponse } from "next/server";
import { autoStatus, mapScheduleItem } from "@/lib/schedule";
import { ScheduleItem, ScheduleSubtask } from "@/types";
import { fail, memberIn, needScope, scopedRow, v1Context } from "@/lib/server/integration";
import { newSubtasks, validateSubtasksBody } from "@/lib/server/v1";

// Appends subtasks to a card; queue=true hands them to the caller's local agent (picked up by GET /api/agent-tasks).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await v1Context(req, "write");
    if (ctx instanceof Response) return ctx;

    const parsed = validateSubtasksBody(await req.json().catch(() => null));
    if (!parsed.ok) return fail(parsed.error, 400);
    // queue=true runs the subtasks on the caller's machine: needs the agent scope on top of write
    const denied = parsed.value.queue ? needScope(ctx, "agent") : null;
    if (denied) return denied;
    const card = await scopedRow(ctx, "schedule_items", (await params).id);
    if (card instanceof Response) return card;

    const added = newSubtasks(parsed.value.texts, parsed.value.queue ? memberIn(ctx, card.organization_id) : null);
    const next: ScheduleSubtask[] = [...(Array.isArray(card.subtasks) ? (card.subtasks as ScheduleSubtask[]) : []), ...added];
    const status = autoStatus({ status: card.status } as ScheduleItem, next) ?? card.status;
    // shortcut: read-modify-write of the jsonb array, so a UI edit in the same instant can be lost; switch to an RPC if it ever bites
    const { data, error } = await ctx.supabase.from("schedule_items").update({ subtasks: next, status }).eq("id", card.id).select("*").single();
    if (error) return fail(error.message, 500);
    return NextResponse.json({ card: mapScheduleItem(data), subtaskIds: added.map((s) => s.id) });
}
