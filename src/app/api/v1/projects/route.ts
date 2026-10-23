import { NextResponse } from "next/server";
import { fail, v1Context } from "@/lib/server/integration";
import { mapProject } from "@/lib/server/v1";

export async function GET(req: Request) {
    const ctx = await v1Context(req, "read");
    if (ctx instanceof Response) return ctx;

    const { data, error } = await ctx.supabase.from("projects").select("*").in("organization_id", ctx.orgIds).order("name");
    if (error) return fail(error.message, 500);
    return NextResponse.json({ projects: (data ?? []).map(mapProject) });
}
