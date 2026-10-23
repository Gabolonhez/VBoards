import { NextResponse } from "next/server";
import { mapScheduleItem } from "@/lib/schedule";
import { todayInBrazil } from "@/lib/utils";
import { fail, memberIn, v1Context } from "@/lib/server/integration";
import { isDate, newSubtasks, pickOrg, SCHEDULE_SCOPES, validateScheduleCreate } from "@/lib/server/v1";

// Planning cards (schedule_items). Day cards are titled like the repo (see findDayCard).
export async function GET(req: Request) {
    const ctx = await v1Context(req, "read");
    if (ctx instanceof Response) return ctx;

    const params = new URL(req.url).searchParams;
    const date = params.get("date");
    const scope = params.get("scope");
    if (date && !isDate(date)) return fail("date must be YYYY-MM-DD", 400);
    if (scope && !SCHEDULE_SCOPES.includes(scope as never)) return fail(`scope must be ${SCHEDULE_SCOPES.join("|")}`, 400);

    let query = ctx.supabase.from("schedule_items").select("*").in("organization_id", ctx.orgIds);
    if (date) query = query.eq("date", date);
    if (scope) query = query.eq("scope", scope);
    const { data, error } = await query.order("date", { ascending: false }).order("position", { ascending: true }).limit(500);
    if (error) return fail(error.message, 500);
    return NextResponse.json({ cards: (data ?? []).map(mapScheduleItem) });
}

export async function POST(req: Request) {
    const ctx = await v1Context(req, "write");
    if (ctx instanceof Response) return ctx;

    const parsed = validateScheduleCreate(await req.json().catch(() => null));
    if (!parsed.ok) return fail(parsed.error, 400);
    const { title, date, scope, description, subtasks, organizationId } = parsed.value;
    const picked = pickOrg(ctx.orgIds, organizationId);
    if ("error" in picked) return fail(picked.error, picked.status);

    const { data, error } = await ctx.supabase
        .from("schedule_items")
        .insert({
            organization_id: picked.orgId,
            scope,
            status: "todo",
            title,
            description: description ?? null,
            date: date ?? todayInBrazil(),
            assignee_id: memberIn(ctx, picked.orgId), // the caller's own card
            subtasks: newSubtasks(subtasks, null),
            position: 0,
        })
        .select("*")
        .single();
    if (error) return fail(error.message, 500);
    return NextResponse.json({ card: mapScheduleItem(data) }, { status: 201 });
}
