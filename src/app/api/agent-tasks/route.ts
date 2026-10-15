import { NextResponse } from "next/server";
import { ScheduleSubtask } from "@/types";
import { checkAuth, serviceClient, findMembers } from "@/lib/server/integration";

// AgenticOffice polls this for the subtasks the given user queued for an agent.
export async function GET(req: Request) {
    const denied = checkAuth(req);
    if (denied) return denied;

    const email = (new URL(req.url).searchParams.get("email") ?? "").trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

    const supabase = serviceClient();
    const { members, error: membersError } = await findMembers(supabase, email);
    if (membersError) return NextResponse.json({ error: membersError }, { status: 500 });
    if (!members.length) return NextResponse.json({ tasks: [] });
    const ids = new Set(members.map((m) => m.id));

    const { data: cards, error } = await supabase
        .from("schedule_items")
        .select("id, title, date, subtasks")
        .in("organization_id", members.map((m) => m.organization_id));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const tasks = (cards ?? []).flatMap((c) =>
        (Array.isArray(c.subtasks) ? (c.subtasks as ScheduleSubtask[]) : [])
            .filter((s) => s.agent?.status === "queued" && ids.has(s.agent.requestedBy))
            .map((s) => ({ cardId: c.id, subtaskId: s.id, text: s.text, cardTitle: c.title, date: c.date }))
    );
    return NextResponse.json({ tasks });
}
