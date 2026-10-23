import { NextResponse } from "next/server";
import { mapScheduleItem } from "@/lib/schedule";
import { ScheduleRefine } from "@/types";
import { fail, memberIn, scopedRow, v1Context } from "@/lib/server/integration";

// "Refinar com agente" (same shape the card UI writes); the runner picks it up from GET /api/agent-tasks `refines`.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await v1Context(req, "write");
    if (ctx instanceof Response) return ctx;

    const card = await scopedRow(ctx, "schedule_items", (await params).id);
    if (card instanceof Response) return card;
    const current = card.refine as ScheduleRefine | null;
    if (current?.status === "queued" || current?.status === "running") return fail(`refine already ${current.status}`, 409);

    const refine: ScheduleRefine = { status: "queued", requestedBy: memberIn(ctx, card.organization_id), updatedAt: new Date().toISOString() };
    const { data, error } = await ctx.supabase.from("schedule_items").update({ refine }).eq("id", card.id).select("*").single();
    if (error) return fail(error.message, 500);
    return NextResponse.json({ card: mapScheduleItem(data) });
}
