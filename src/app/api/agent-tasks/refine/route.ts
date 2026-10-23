import { NextResponse } from "next/server";
import { ScheduleItem, ScheduleSubtask } from "@/types";
import { checkAuth, serviceClient, findMembers } from "@/lib/server/integration";
import { validateRefineBody, mergeRefineReady } from "@/lib/server/refine";

// AgenticOffice reports progress/result of a "refine with agent" request here.
export async function POST(req: Request) {
    const denied = checkAuth(req);
    if (denied) return denied;

    const parsed = validateRefineBody(await req.json().catch(() => null));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { email, cardId, status, plan, questions, subtasks: proposed, error: failure } = parsed.value;

    const supabase = serviceClient();
    const { members, error: membersError } = await findMembers(supabase, email);
    if (membersError) return NextResponse.json({ error: membersError }, { status: 500 });

    const { data: card, error: readError } = await supabase.from("schedule_items").select("*").eq("id", cardId).maybeSingle();
    if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
    const refine = card?.refine as ScheduleItem["refine"];
    if (!card || !refine || !members.some((m) => m.organization_id === card.organization_id) || !members.some((m) => m.id === refine.requestedBy)) {
        return NextResponse.json({ error: "card not found" }, { status: 404 });
    }

    let update: Record<string, unknown>;
    let subtaskIds: string[] = refine.subtaskIds ?? [];
    if (status === "ready") {
        const merged = mergeRefineReady(Array.isArray(card.subtasks) ? (card.subtasks as ScheduleSubtask[]) : [], refine, { plan, questions, subtasks: proposed });
        subtaskIds = merged.refine.subtaskIds!;
        update = { subtasks: merged.subtasks, refine: merged.refine };
    } else {
        update = { refine: { ...refine, status, updatedAt: new Date().toISOString(), ...(status === "failed" ? { error: failure ?? "failed" } : {}) } };
    }
    // shortcut: read-modify-write of the jsonb array (same as update/route.ts), a UI edit in the same instant can be lost
    const { error } = await supabase.from("schedule_items").update(update).eq("id", cardId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, subtaskIds });
}
