import { afterEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ token: null as Record<string, unknown> | null, touched: false }));

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));

// Service-role stand-in: api_tokens answers with db.token; anything else would mean a legacy lookup by email.
vi.mock("@supabase/supabase-js", () => ({
    createClient: () => ({
        from(table: string) {
            db.touched = true;
            const q = {
                select: () => q,
                eq: () => q,
                update: () => q,
                maybeSingle: async () => ({ data: table === "api_tokens" ? db.token : null, error: null }),
                then: (ok: (v: unknown) => unknown) => ok({ data: [], error: null }),
            };
            return q;
        },
    }),
}));

import { agentCaller } from "./integration";

const req = (authorization: string) => new Request("http://x/api/agent-tasks?email=victim@x.com", { headers: { authorization } });

afterEach(() => {
    vi.unstubAllEnvs();
    db.token = null;
    db.touched = false;
});

describe("agentCaller", () => {
    it("the legacy COMMIT_HOOK_SECRET no longer authenticates, even while still set", async () => {
        vi.stubEnv("COMMIT_HOOK_SECRET", "hook");
        const res = await agentCaller(req("Bearer hook"));
        expect(res).toBeInstanceOf(Response);
        expect((res as Response).status).toBe(401);
        expect(db.touched).toBe(false);
    });

    it("a vb_ token with the agent scope is its owner (the email param is ignored)", async () => {
        db.token = { id: "t1", user_id: "u1", user_email: "Ana@X.com", scopes: ["agent"], last_used_at: new Date().toISOString(), revoked_at: null, expires_at: null };
        expect(await agentCaller(req("Bearer vb_" + "a".repeat(43)))).toEqual({ userId: "u1", email: "ana@x.com", scopes: ["agent"] });
    });

    it("a vb_ token without the agent scope gets 403", async () => {
        db.token = { id: "t1", user_id: "u1", user_email: "ana@x.com", scopes: ["read", "write"], last_used_at: new Date().toISOString(), revoked_at: null, expires_at: null };
        expect(((await agentCaller(req("Bearer vb_" + "a".repeat(43)))) as Response).status).toBe(403);
    });
});
