import { NextResponse } from "next/server";
import { ScheduleSubtask } from "@/types";
import { pendingRefines } from "@/lib/server/refine";
import { agentCaller, fail, serviceClient, findMembers } from "@/lib/server/integration";

// AgenticOffice polls this for the subtasks the given user queued for an agent.
export async function GET(req: Request) {
    const caller = await agentCaller(req);
    if (caller instanceof Response) return caller;

    const email = caller.email;
    if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

    const supabase = serviceClient();
    const { members, error: membersError } = await findMembers(supabase, caller.userId);
    if (membersError) return fail(membersError, 500);
    if (!members.length) return NextResponse.json({ tasks: [], refines: [] });
    const ids = new Set(members.map((m) => m.id));

    const { data: cards, error } = await supabase
        .from("schedule_items")
        .select("id, title, description, date, subtasks, refine")
        .in("organization_id", members.map((m) => m.organization_id));
    if (error) return fail(error.message, 500);

    const tasks = (cards ?? []).flatMap((c) =>
        (Array.isArray(c.subtasks) ? (c.subtasks as ScheduleSubtask[]) : [])
            .filter((s) => s.agent?.status === "queued" && ids.has(s.agent.requestedBy))
            .map((s) => ({ cardId: c.id, subtaskId: s.id, text: s.text, cardTitle: c.title, date: c.date, risk: s.risk, riskWhy: s.riskWhy, approvedAt: s.agent!.approvedAt, stage: s.agent!.stage, prUrl: s.agent!.prUrl }))
    );
    return NextResponse.json({ tasks, refines: pendingRefines(cards ?? [], ids) });
}
