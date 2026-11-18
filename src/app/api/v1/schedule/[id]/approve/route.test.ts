import { beforeEach, describe, expect, it, vi } from "vitest";

const CARD = "11111111-1111-4111-8111-111111111111";
const db = vi.hoisted(() => ({ user: null as { id: string; email: string } | null, card: {} as Record<string, unknown>, updates: [] as unknown[], touched: false }));

vi.mock("@/lib/supabase/server", () => ({
    createClient: async () => ({ auth: { getUser: async () => ({ data: { user: db.user } }) } }),
}));

// Minimal chainable stand-in for the service-role client: each table answers with fixed rows.
vi.mock("@supabase/supabase-js", () => ({
    createClient: () => ({
        from(table: string) {
            db.touched = true;
            const rows: Record<string, unknown> = {
                team_members: [{ id: "m1", organization_id: "o1", commit_log: null, name: "Ana", user_id: "u1" }],
                organization_members: [{ organization_id: "o1" }],
            };
            let patch: Record<string, unknown> | null = null;
            const q = {
                select: () => q,
                eq: () => q,
                update: (p: Record<string, unknown>) => ((patch = p), db.updates.push(p), q),
                maybeSingle: async () => ({ data: db.card, error: null }),
                single: async () => ({ data: { ...db.card, ...patch }, error: null }),
                then: (ok: (v: unknown) => unknown) => ok({ data: rows[table] ?? [], error: null }),
            };
            return q;
        },
    }),
}));

import { POST } from "./route";

const call = (headers: Record<string, string> = {}) =>
    POST(new Request(`http://x/api/v1/schedule/${CARD}/approve`, { method: "POST", headers }), { params: Promise.resolve({ id: CARD }) });

beforeEach(() => {
    db.user = null;
    db.updates = [];
    db.touched = false;
    db.card = {
        id: CARD,
        organization_id: "o1",
        status: "todo",
        subtasks: [{ id: "p1", text: "plan step", done: false }],
        refine: { status: "ready", requestedBy: "m1", subtaskIds: ["p1"], updatedAt: "t" },
    };
});

describe("POST /api/v1/schedule/:id/approve", () => {
    it("refuses any API token, agent scope included, before touching the database", async () => {
        db.user = { id: "u1", email: "ana@x.com" }; // even alongside a session cookie
        const res = await call({ authorization: "Bearer vb_" + "a".repeat(43) });
        expect(res.status).toBe(403);
        expect(db.touched).toBe(false);
        expect(db.updates).toEqual([]);
    });

    it("401 without a signed-in user", async () => {
        expect((await call()).status).toBe(401);
        expect(db.updates).toEqual([]);
    });

    it("a signed-in human approves: subtasks queued with approvedAt", async () => {
        db.user = { id: "u1", email: "ana@x.com" };
        const res = await call();
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ queuedSubtaskIds: ["p1"] });
        const [update] = db.updates as { subtasks: { agent: { status: string; requestedBy: string; approvedAt: string } }[]; refine: null }[];
        expect(update.refine).toBeNull();
        expect(update.subtasks[0].agent).toMatchObject({ status: "queued", requestedBy: "m1" });
        expect(update.subtasks[0].agent.approvedAt).toBeTruthy();
    });
});
