import { NextResponse } from "next/server";
import { autoStatus } from "@/lib/schedule";
import { todayInBrazil } from "@/lib/utils";
import { ScheduleItem, ScheduleSubtask } from "@/types";
import { checkAuth, serviceClient, findMembers } from "@/lib/server/integration";

const STATUSES = ["running", "done", "failed"] as const;

export async function POST(req: Request) {
    const denied = checkAuth(req);
    if (denied) return denied;

    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const { cardId, subtaskId, status } = body ?? {};
    if (!email || typeof cardId !== "string" || !cardId || typeof subtaskId !== "string" || !subtaskId || !STATUSES.includes(status)) {
        return NextResponse.json({ error: "email, cardId, subtaskId and status (running|done|failed) are required" }, { status: 400 });
    }
    if (body.summary !== undefined && typeof body.summary !== "string") {
        return NextResponse.json({ error: "summary must be a string" }, { status: 400 });
    }
    const summary = typeof body.summary === "string" ? body.summary.trim().slice(0, 2000) : undefined;

    const supabase = serviceClient();
    const { members, error: membersError } = await findMembers(supabase, email);
    if (membersError) return NextResponse.json({ error: membersError }, { status: 500 });

    // Re-read right before writing to keep the read-modify-write window small
    const { data: card, error: readError } = await supabase.from("schedule_items").select("*").eq("id", cardId).maybeSingle();
    if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
    const subtasks: ScheduleSubtask[] = Array.isArray(card?.subtasks) ? card.subtasks : [];
    const sub = subtasks.find((s) => s.id === subtaskId);
    if (!card || !sub) return NextResponse.json({ error: "card or subtask not found" }, { status: 404 });
    if (!sub.agent || !members.some((m) => m.id === sub.agent!.requestedBy)) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const today = todayInBrazil();
    const next: ScheduleSubtask[] = subtasks.map((s) =>
        s.id !== subtaskId
            ? s
            : {
                  ...s,
                  ...(status === "done" ? { done: true, doneAt: today } : {}),
                  agent: { ...sub.agent!, status, summary: summary ?? sub.agent!.summary, updatedAt: new Date().toISOString() },
              }
    );
    const newStatus = status === "done" ? autoStatus({ status: card.status } as ScheduleItem, next) ?? card.status : card.status;
    // shortcut: read-modify-write of the jsonb array, so a UI edit in the same instant can be lost; switch to an RPC that patches one element if it ever bites
    const { error } = await supabase.from("schedule_items").update({ subtasks: next, status: newStatus }).eq("id", cardId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, status: newStatus });
}
