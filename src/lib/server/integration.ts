import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { todayInBrazil } from "@/lib/utils";

// Shared by the machine-to-machine routes (git hook, AgenticOffice): no user session, so they authenticate
// by shared secret and write with the service role key.
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function checkAuth(req: Request): NextResponse | null {
    const secret = process.env.COMMIT_HOOK_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return null;
}

export function serviceClient() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false },
    });
}

export type ServiceClient = ReturnType<typeof serviceClient>;
export interface MemberRow {
    id: string;
    organization_id: string;
    commit_log: boolean | null;
}

export async function findMembers(supabase: ServiceClient, email: string) {
    const { data, error } = await supabase
        .from("team_members")
        .select("id, organization_id, commit_log")
        .ilike("email", email);
    return { members: (data ?? []) as MemberRow[], error: error?.message };
}

// Today's card titled like the repo, or an overdue open one (the Planning page rolls those forward to today anyway).
// Prefers the member's own card, then the most recent date.
export async function findDayCard(supabase: ServiceClient, members: MemberRow[], repo: string) {
    const today = todayInBrazil();
    const { data: cards, error } = await supabase
        .from("schedule_items")
        .select("*")
        .eq("scope", "day")
        .in("organization_id", members.map((m) => m.organization_id))
        .lte("date", today);
    if (error) return { card: undefined, error: error.message };
    const ids = new Set(members.map((m) => m.id));
    const score = (c: { assignee_id: string | null; date: string }) =>
        (ids.has(c.assignee_id as string) ? 2 : 0) + (c.date === today ? 1 : 0);
    const card = (cards ?? [])
        .filter((c) => norm(c.title) === norm(repo) && (c.date === today || c.status !== "done"))
        .sort((a, b) => score(b) - score(a) || String(b.date).localeCompare(String(a.date)))[0];
    return { card, error: undefined };
}
