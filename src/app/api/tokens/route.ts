import { NextResponse } from "next/server";
import { fail, serviceClient, sessionUser } from "@/lib/server/integration";
import { expiryFor, hashToken, MAX_ACTIVE_TOKENS, newToken, validateScopes, validateTokenName } from "@/lib/server/tokens";

// Settings → API tokens. Logged-in user only (session cookie); api_tokens is service-role only, scoped here by the
// auth user id (tokens without user_id predate it and are invalid, so they are not listed).
const mapToken = (t: Record<string, unknown>) => ({
    id: t.id,
    name: t.name,
    scopes: t.scopes,
    createdAt: t.created_at,
    lastUsedAt: t.last_used_at ?? null,
    expiresAt: t.expires_at ?? null,
});

const COLUMNS = "id, name, scopes, created_at, last_used_at, expires_at";

export async function GET() {
    const user = await sessionUser();
    if (!user) return fail("unauthorized", 401);
    const { data, error } = await serviceClient()
        .from("api_tokens")
        .select(COLUMNS)
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });
    if (error) return fail(error.message, 500);
    return NextResponse.json({ tokens: (data ?? []).map(mapToken) });
}

export async function POST(req: Request) {
    const user = await sessionUser();
    if (!user) return fail("unauthorized", 401);
    const body = await req.json().catch(() => null);
    const name = validateTokenName(body?.name);
    if (!name) return fail("name must be a string of 1-100 chars", 400);
    const scopes = validateScopes(body?.scopes);
    if (!scopes) return fail("scopes must be a non-empty subset of read, write, agent", 400);
    const expiry = expiryFor(body?.expiresInDays);
    if (!expiry) return fail("expiresInDays must be 30, 90, 365 or null", 400);

    const supabase = serviceClient();
    // shortcut: count-then-insert, two parallel requests can end at 21; add a DB trigger if that ever matters
    const { count, error: countError } = await supabase
        .from("api_tokens")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("revoked_at", null)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
    if (countError) return fail(countError.message, 500);
    if ((count ?? 0) >= MAX_ACTIVE_TOKENS) return fail(`too many active tokens (max ${MAX_ACTIVE_TOKENS}), revoke one first`, 409);

    const token = newToken();
    const { data, error } = await supabase
        .from("api_tokens")
        .insert({ user_id: user.id, user_email: user.email, name, scopes, expires_at: expiry.expiresAt, token_hash: hashToken(token) })
        .select(COLUMNS)
        .single();
    if (error) return fail(error.message, 500);
    // The only time the plain token leaves the server
    return NextResponse.json({ ...mapToken(data), token }, { status: 201 });
}
