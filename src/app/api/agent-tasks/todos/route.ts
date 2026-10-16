import { NextResponse } from "next/server";
import { autoStatus } from "@/lib/schedule";
import { todayInBrazil } from "@/lib/utils";
import { ScheduleItem, ScheduleSubtask } from "@/types";
import { checkAuth, serviceClient, findMembers, findDayCard } from "@/lib/server/integration";

// Mirrors what the user's agents worked on (one item per conversation, with the agent's closing summary) onto the
// repo's day card, for members who turned on work logging in Settings.
export async function POST(req: Request) {
    const denied = checkAuth(req);
    if (denied) return denied;

    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const repo = typeof body?.repo === "string" ? body.repo.trim() : "";
    const raw = body?.todos;
    if (!email || !repo || !Array.isArray(raw) || raw.length > 50) {
        return NextResponse.json({ error: "email, repo and todos (max 50) are required" }, { status: 400 });
    }
    const todos: { text: string; done: boolean; summary?: string }[] = [];
    for (const t of raw) {
        const text = typeof t?.text === "string" ? t.text.trim() : "";
        if (!text || text.length > 500 || typeof t.done !== "boolean") {
            return NextResponse.json({ error: "each todo needs text (1-500 chars) and boolean done" }, { status: 400 });
        }
        if (t.summary !== undefined && typeof t.summary !== "string") {
            return NextResponse.json({ error: "summary must be a string" }, { status: 400 });
        }
        todos.push({ text, done: t.done, summary: typeof t.summary === "string" ? t.summary.trim().slice(0, 2000) || undefined : undefined });
    }

    const supabase = serviceClient();
    const { members, error: membersError } = await findMembers(supabase, email);
    if (membersError) return NextResponse.json({ error: membersError }, { status: 500 });
    const enabled = members.filter((m) => m.commit_log);
    if (!enabled.length) return NextResponse.json({ skipped: "commit log is off" });

    const { card, error: cardsError } = await findDayCard(supabase, enabled, repo);
    if (cardsError) return NextResponse.json({ error: cardsError }, { status: 500 });
    if (!card) return NextResponse.json({ skipped: `no day card titled "${repo}"` });

    const today = todayInBrazil();
    // The summary renders through the subtask's agent badge, which needs the member it belongs to
    const memberId = enabled.find((m) => m.organization_id === card.organization_id)?.id ?? enabled[0].id;
    const withSummary = (s: ScheduleSubtask, summary?: string): ScheduleSubtask =>
        summary ? { ...s, agent: { status: "done", requestedBy: memberId, summary, updatedAt: new Date().toISOString() } } : s;
    const next: ScheduleSubtask[] = Array.isArray(card.subtasks) ? [...card.subtasks] : [];
    let added = 0;
    let completed = 0;
    for (const todo of todos) {
        const i = next.findIndex((s) => s.text === todo.text);
        if (i >= 0) {
            if (todo.done && !next[i].done) {
                next[i] = withSummary({ ...next[i], done: true, doneAt: today }, todo.summary);
                completed++;
            } else if (todo.summary && next[i].source === "agent" && next[i].agent?.summary !== todo.summary) {
                // Same conversation worked again: keep the item, refresh its summary
                next[i] = withSummary(next[i], todo.summary);
                completed++;
            }
        } else {
            next.push(withSummary({ id: crypto.randomUUID(), text: todo.text, done: todo.done, doneAt: todo.done ? today : null, source: "agent" }, todo.done ? todo.summary : undefined));
            added++;
        }
    }
    if (!added && !completed) return NextResponse.json({ skipped: "nothing changed" });

    const status = autoStatus({ status: card.status } as ScheduleItem, next) ?? card.status;
    // shortcut: read-modify-write of the jsonb array, so a UI edit in the same instant can be lost; switch to an RPC if it ever bites
    const { error } = await supabase.from("schedule_items").update({ subtasks: next, status }).eq("id", card.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ card: card.title, added, completed });
}
