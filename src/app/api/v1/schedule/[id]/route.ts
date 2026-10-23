import { NextResponse } from "next/server";
import { mapScheduleItem } from "@/lib/schedule";
import { fail, scopedRow, v1Context } from "@/lib/server/integration";
import { validateSchedulePatch } from "@/lib/server/v1";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await v1Context(req, "write");
    if (ctx instanceof Response) return ctx;

    const parsed = validateSchedulePatch(await req.json().catch(() => null));
    if (!parsed.ok) return fail(parsed.error, 400);
    const card = await scopedRow(ctx, "schedule_items", (await params).id);
    if (card instanceof Response) return card;

    const update: Record<string, unknown> = { ...parsed.value };
    Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);
    const { data, error } = await ctx.supabase.from("schedule_items").update(update).eq("id", card.id).select("*").single();
    if (error) return fail(error.message, 500);
    return NextResponse.json({ card: mapScheduleItem(data) });
}
