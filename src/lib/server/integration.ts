import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { todayInBrazil } from "@/lib/utils";
import { createClient as sessionClient } from "@/lib/supabase/server";
import { agentAuthKind, bearer, hashToken, looksLikeToken, missingScope, shouldTouch, TOKEN_SCOPES, tokenUsable, type TokenScope } from "@/lib/server/tokens";
import { normalizeEmail, pickLegacyUser, selectMembers } from "@/lib/server/identity";
import { isUuid } from "@/lib/server/v1";

// Shared by the machine-to-machine routes (git hook, AgenticOffice): no user session, so they authenticate
// by shared secret and write with the service role key.
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** JSON error. A 500's detail (DB messages etc.) is only logged; the client gets "internal error". */
export function fail(error: string, status: number) {
    if (status === 500) {
        console.error("api error:", error);
        error = "internal error";
    }
    return NextResponse.json({ error }, { status });
}

export function checkAuth(req: Request): NextResponse | null {
    if (agentAuthKind(req.headers.get("authorization"), process.env.COMMIT_HOOK_SECRET) !== "legacy") {
        return fail("unauthorized", 401);
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
    name: string | null;
}

/** The auth user's team_members rows, only in orgs where organization_members has them too (see selectMembers). */
export async function findMembers(supabase: ServiceClient, userId: string): Promise<{ members: MemberRow[]; error?: string }> {
    if (!userId) return { members: [] };
    const [rows, memberships] = await Promise.all([
        supabase.from("team_members").select("id, organization_id, commit_log, name, user_id").eq("user_id", userId),
        supabase.from("organization_members").select("organization_id").eq("user_id", userId),
    ]);
    const error = rows.error ?? memberships.error;
    if (error) return { members: [], error: error.message };
    const orgIds = (memberships.data ?? []).map((m) => m.organization_id as string);
    return { members: selectMembers(userId, (rows.data ?? []) as (MemberRow & { user_id: string | null })[], orgIds) };
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

export interface Caller {
    userId: string; // auth.users id: the identity every route scopes by
    email: string;
    scopes: readonly TokenScope[];
}

/** `Authorization: Bearer vb_...` (per-user API token) -> the token owner, or a 401/500 response. */
export async function authenticate(req: Request, supabase: ServiceClient = serviceClient()): Promise<Caller | NextResponse> {
    const token = bearer(req);
    if (!looksLikeToken(token)) return fail("unauthorized", 401);
    // Lookup by the sha256 of a 256-bit random token: no timing oracle worth guarding against here
    const { data, error } = await supabase
        .from("api_tokens")
        .select("id, user_id, user_email, scopes, last_used_at, revoked_at, expires_at")
        .eq("token_hash", hashToken(token))
        .maybeSingle();
    if (error) return fail(error.message, 500);
    // Tokens created before user_id existed have none: invalid, the user recreates them
    if (!data || !tokenUsable(data)) return fail("unauthorized", 401);
    if (shouldTouch(data.last_used_at)) {
        await supabase.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
    }
    return { userId: data.user_id, email: normalizeEmail(data.user_email), scopes: Array.isArray(data.scopes) ? data.scopes : [] };
}

/** 403 when the caller lacks `scope`, else null. */
export function needScope(caller: Pick<Caller, "scopes">, scope: TokenScope): NextResponse | null {
    const missing = missingScope(caller.scopes, scope);
    return missing ? fail(missing, 403) : null;
}

/**
 * agent-tasks routes: a vb_ token with the `agent` scope (identity comes from it, the email param is ignored) or the
 * legacy COMMIT_HOOK_SECRET + email param. Legacy email -> the auth user whose own email it is (exact match, verified
 * against auth.users); no such user = userId "" (no members, so nothing is returned or written).
 */
export async function agentCaller(req: Request, email: unknown): Promise<Caller | NextResponse> {
    const kind = agentAuthKind(req.headers.get("authorization"), process.env.COMMIT_HOOK_SECRET);
    if (kind === "token") {
        const caller = await authenticate(req);
        if (caller instanceof Response) return caller;
        return needScope(caller, "agent") ?? caller;
    }
    if (kind !== "legacy") return fail("unauthorized", 401);
    const normalized = normalizeEmail(email);
    if (!normalized) return { userId: "", email: "", scopes: TOKEN_SCOPES };
    const supabase = serviceClient();
    const { data, error } = await supabase.from("team_members").select("user_id").eq("email", normalized).not("user_id", "is", null);
    if (error) return fail(error.message, 500);
    const userId = await pickLegacyUser(normalized, (data ?? []).map((r) => r.user_id), async (id) => {
        const { data: u } = await supabase.auth.admin.getUserById(id);
        return u.user?.email ?? null;
    });
    return { userId, email: normalized, scopes: TOKEN_SCOPES };
}

export interface V1Context extends Caller {
    supabase: ServiceClient;
    members: MemberRow[];
    orgIds: string[];
}

/**
 * /api/v1: vb_ token only, with `scope` (403 otherwise). Every query is scoped to orgIds (the organizations of the
 * caller's team_members, see findMembers).
 */
export async function v1Context(req: Request, scope: TokenScope, allowNoMembers = false): Promise<V1Context | NextResponse> {
    const supabase = serviceClient();
    const auth = await authenticate(req, supabase);
    if (auth instanceof Response) return auth;
    const denied = needScope(auth, scope);
    if (denied) return denied;
    const { members, error } = await findMembers(supabase, auth.userId);
    if (error) return fail(error, 500);
    if (!members.length && !allowNoMembers) return fail("no team membership for this token's user", 404);
    return { ...auth, supabase, members, orgIds: [...new Set(members.map((m) => m.organization_id))] };
}

/** The logged-in user (Supabase session cookie, verified by getUser), for the token management routes. */
export async function sessionUser(): Promise<{ id: string; email: string } | null> {
    const supabase = await sessionClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user ? { id: user.id, email: normalizeEmail(user.email) } : null;
}

/** A tasks / schedule_items row by id, only if it belongs to one of the caller's organizations (else 404). */
export async function scopedRow(ctx: V1Context, table: "tasks" | "schedule_items", id: string): Promise<Record<string, unknown> | NextResponse> {
    if (!isUuid(id)) return fail("not found", 404);
    const { data, error } = await ctx.supabase.from(table).select("*").eq("id", id).maybeSingle();
    if (error) return fail(error.message, 500);
    if (!data || !ctx.orgIds.includes(data.organization_id)) return fail("not found", 404);
    return data;
}

/** The caller's team_member id in an organization (always found for an org that came from ctx.orgIds). */
export const memberIn = (ctx: V1Context, orgId: unknown) => ctx.members.find((m) => m.organization_id === orgId)!.id;
