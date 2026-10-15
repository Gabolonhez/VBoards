import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { autoStatus } from "@/lib/schedule";
import { todayInBrazil } from "@/lib/utils";
import { ScheduleItem, ScheduleSubtask } from "@/types";

// Called by the global git post-commit hook (scripts/git-hooks): checks the commit off as a done subtask on the
// Planning day card titled like the repo. There is no user session here, so it authenticates by shared secret
// and writes with the service role key.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function POST(req: Request) {
    const secret = process.env.COMMIT_HOOK_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const form = await req.formData();
    const repo = String(form.get("repo") ?? "").trim();
    const message = String(form.get("message") ?? "").trim();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    if (!repo || !message || !email) {
        return NextResponse.json({ error: "repo, message and email are required" }, { status: 400 });
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false },
    });

    // The committer must be a team member; their organizations bound which cards the hook may touch
    const { data: members, error: membersError } = await supabase
        .from("team_members")
        .select("id, organization_id")
        .ilike("email", email);
    if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 });
    if (!members?.length) return NextResponse.json({ skipped: "committer is not a team member" });

    const today = todayInBrazil();
    const { data: cards, error: cardsError } = await supabase
        .from("schedule_items")
        .select("*")
        .eq("scope", "day")
        .in("organization_id", members.map((m) => m.organization_id))
        .lte("date", today);
    if (cardsError) return NextResponse.json({ error: cardsError.message }, { status: 500 });

    // Today's card, or an overdue open one (the Planning page rolls those forward to today anyway).
    // Prefer the committer's own card, then the most recent date.
    const memberIds = new Set(members.map((m) => m.id));
    const score = (c: { assignee_id: string | null; date: string }) => (memberIds.has(c.assignee_id) ? 2 : 0) + (c.date === today ? 1 : 0);
    const card = (cards ?? [])
        .filter((c) => norm(c.title) === norm(repo) && (c.date === today || c.status !== "done"))
        .sort((a, b) => score(b) - score(a) || String(b.date).localeCompare(String(a.date)))[0];
    if (!card) return NextResponse.json({ skipped: `no day card titled "${repo}"` });

    const subtasks: ScheduleSubtask[] = Array.isArray(card.subtasks) ? card.subtasks : [];
    // Amends and rebases re-run the hook with the same message
    if (subtasks.some((s) => s.text === message)) return NextResponse.json({ skipped: "already logged" });

    const next: ScheduleSubtask[] = [...subtasks, { id: crypto.randomUUID(), text: message, done: true, doneAt: today }];
    const status = autoStatus({ status: card.status } as ScheduleItem, next) ?? card.status;
    // shortcut: read-modify-write of the jsonb array, so a UI edit in the same instant can be lost; switch to an RPC that appends with jsonb || if it ever bites
    const { error } = await supabase
        .from("schedule_items")
        .update({ subtasks: next, status, date: today })
        .eq("id", card.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ card: card.title, status });
}
