import { NextResponse } from "next/server";
import { fail, serviceClient, sessionUser } from "@/lib/server/integration";
import { isUuid } from "@/lib/server/v1";

// Revokes one of the caller's own tokens (kept as a row with revoked_at, so last use stays auditable).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await sessionUser();
    if (!user) return fail("unauthorized", 401);
    const { id } = await params;
    if (!isUuid(id)) return fail("not found", 404);

    const { data, error } = await serviceClient()
        .from("api_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .select("id");
    if (error) return fail(error.message, 500);
    if (!data?.length) return fail("not found", 404);
    return NextResponse.json({ ok: true });
}
