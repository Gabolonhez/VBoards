import { createHash, randomBytes } from "node:crypto";

// Per-user API tokens (Settings → API tokens). Only the sha256 is stored; the plain token is shown once.
export const TOKEN_PREFIX = "vb_";

export const newToken = () => TOKEN_PREFIX + randomBytes(32).toString("base64url");

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// 32 bytes base64url = 43 chars, no padding
export const looksLikeToken = (token: string) => /^vb_[A-Za-z0-9_-]{43}$/.test(token);

export function bearer(req: Request): string {
    const h = req.headers.get("authorization") ?? "";
    return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

/** last_used_at is written at most once per minute per token. */
export function shouldTouch(lastUsedAt: string | null | undefined, now = Date.now()): boolean {
    if (!lastUsedAt) return true;
    const t = Date.parse(lastUsedAt);
    return Number.isNaN(t) || now - t >= 60_000;
}

export function validateTokenName(v: unknown): string | null {
    if (typeof v !== "string") return null;
    const name = v.trim();
    return name && name.length <= 100 ? name : null;
}

// read = GETs; write = create/patch tasks & cards, subtasks without queue, refine request;
// agent = work that runs on the user's machine (agent-tasks, queue=true) and the Jarvis inbox.
// No scope approves a refine plan: only a signed-in human does (humanContext in integration.ts).
export const TOKEN_SCOPES = ["read", "write", "agent"] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];
export const DEFAULT_SCOPES: TokenScope[] = ["read", "write"];
export const MAX_ACTIVE_TOKENS = 20;
export const TOKEN_EXPIRY_DAYS = [30, 90, 365] as const; // or null = never
export const DEFAULT_EXPIRY_DAYS = 90;

/** null when `scopes` grants `needed`, else the 403 message. */
export const missingScope = (scopes: readonly string[], needed: TokenScope): string | null =>
    scopes.includes(needed) ? null : `missing scope ${needed}`;

/** POST /api/tokens `scopes`: omitted = default, else a non-empty subset of TOKEN_SCOPES (deduped). */
export function validateScopes(v: unknown): TokenScope[] | null {
    if (v === undefined) return [...DEFAULT_SCOPES];
    if (!Array.isArray(v) || !v.length || !v.every((s) => TOKEN_SCOPES.includes(s))) return null;
    return TOKEN_SCOPES.filter((s) => v.includes(s));
}

/** POST /api/tokens `expiresInDays`: omitted = 90, null = never, else 30|90|365. Returns the expires_at ISO or null. */
export function expiryFor(v: unknown, now = Date.now()): { expiresAt: string | null } | null {
    const days = v === undefined ? DEFAULT_EXPIRY_DAYS : v;
    if (days === null) return { expiresAt: null };
    if (!TOKEN_EXPIRY_DAYS.includes(days as never)) return null;
    return { expiresAt: new Date(now + (days as number) * 86_400_000).toISOString() };
}

/** A token row authenticates only if linked to an auth user, not revoked and not expired. */
export function tokenUsable(row: { user_id: string | null; revoked_at: string | null; expires_at: string | null }, now = Date.now()): boolean {
    if (!row.user_id || row.revoked_at) return false;
    return !row.expires_at || Date.parse(row.expires_at) > now;
}
