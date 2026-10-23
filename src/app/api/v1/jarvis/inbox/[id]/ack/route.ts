import { NextResponse } from "next/server";
import { fail, v1Context } from "@/lib/server/integration";
import { isUuid, validateAckBody } from "@/lib/server/v1";

// Marks one of the caller's inbox messages as handled, with Jarvis's optional reply (stored only, not sent).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await v1Context(req, "agent", true);
    if (ctx instanceof Response) return ctx;

    const parsed = validateAckBody(await req.json().catch(() => null));
    if (!parsed.ok) return fail(parsed.error, 400);
    const { id } = await params;
    if (!isUuid(id)) return fail("not found", 404);

    const { data, error } = await ctx.supabase
        .from("jarvis_inbox")
        .update({ acked_at: new Date().toISOString(), reply: parsed.value.reply ?? null })
        .eq("id", id)
        .eq("owner_email", ctx.email)
        .select("id");
    if (error) return fail(error.message, 500);
    if (!data?.length) return fail("not found", 404);
    return NextResponse.json({ ok: true });
}
