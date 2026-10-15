import { NextResponse } from "next/server";
import { autoStatus } from "@/lib/schedule";
import { todayInBrazil } from "@/lib/utils";
import { ScheduleItem, ScheduleSubtask } from "@/types";
import { checkAuth, serviceClient, findMembers, findDayCard } from "@/lib/server/integration";

// Called by the global git post-commit hook (scripts/git-hooks): checks the commit off as a done subtask on the
// Planning day card titled like the repo.
export async function POST(req: Request) {
    const denied = checkAuth(req);
    if (denied) return denied;

    const form = await req.formData();
    const repo = String(form.get("repo") ?? "").trim();
    const message = String(form.get("message") ?? "").trim();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    if (!repo || !message || !email) {
        return NextResponse.json({ error: "repo, message and email are required" }, { status: 400 });
    }

    const supabase = serviceClient();

    // The committer must be a team member; their organizations bound which cards the hook may touch
    const { members, error: membersError } = await findMembers(supabase, email);
    if (membersError) return NextResponse.json({ error: membersError }, { status: 500 });
    if (!members.length) return NextResponse.json({ skipped: "committer is not a team member" });
    const enabled = members.filter((m) => m.commit_log);
    if (!enabled.length) return NextResponse.json({ skipped: "commit log is off" });

    const today = todayInBrazil();
    const { card, error: cardsError } = await findDayCard(supabase, enabled, repo);
    if (cardsError) return NextResponse.json({ error: cardsError }, { status: 500 });
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
