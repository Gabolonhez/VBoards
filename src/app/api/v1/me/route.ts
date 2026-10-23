import { NextResponse } from "next/server";
import { fail, v1Context } from "@/lib/server/integration";

// Who the token belongs to and where it can act (Jarvis / WhatsApp gateway use this to pick organizationId).
export async function GET(req: Request) {
    const ctx = await v1Context(req, "read", true);
    if (ctx instanceof Response) return ctx;

    let organizations: { id: string; name: string }[] = [];
    if (ctx.orgIds.length) {
        const { data, error } = await ctx.supabase.from("organizations").select("id, name").in("id", ctx.orgIds).order("name");
        if (error) return fail(error.message, 500);
        organizations = data ?? [];
    }
    return NextResponse.json({
        email: ctx.email,
        scopes: ctx.scopes,
        members: ctx.members.map((m) => ({ id: m.id, organizationId: m.organization_id, name: m.name })),
        organizations,
    });
}
