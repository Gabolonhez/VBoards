import { NextResponse } from "next/server";
import { approveRefine, autoStatus, mapScheduleItem } from "@/lib/schedule";
import { ScheduleItem, ScheduleRefine, ScheduleSubtask } from "@/types";
import { fail, humanContext, memberIn, scopedRow } from "@/lib/server/integration";

// "Aprovar e enviar ao agente": same as the card button (approveRefine), only on a refine that is ready.
// Signed-in human only: approvedAt is the runner's proof of human approval, so no API token (not even `agent`) may set it.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await humanContext(req);
    if (ctx instanceof Response) return ctx;

    const card = await scopedRow(ctx, "schedule_items", (await params).id);
    if (card instanceof Response) return card;
    const refine = card.refine as ScheduleRefine | null;
    if (refine?.status !== "ready") return fail("card has no refine ready to approve", 409);

    const subtasks = approveRefine(Array.isArray(card.subtasks) ? (card.subtasks as ScheduleSubtask[]) : [], refine, memberIn(ctx, card.organization_id));
    const status = autoStatus({ status: card.status } as ScheduleItem, subtasks) ?? card.status;
    // shortcut: read-modify-write of the jsonb array, so a UI edit in the same instant can be lost; switch to an RPC if it ever bites
    const { data, error } = await ctx.supabase.from("schedule_items").update({ subtasks, refine: null, status }).eq("id", card.id).select("*").single();
    if (error) return fail(error.message, 500);
    const ids = new Set(refine.subtaskIds ?? []);
    return NextResponse.json({
        card: mapScheduleItem(data),
        queuedSubtaskIds: subtasks.filter((s) => ids.has(s.id) && s.agent?.status === "queued").map((s) => s.id),
    });
}
