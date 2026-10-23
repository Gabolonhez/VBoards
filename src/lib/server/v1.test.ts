import { describe, expect, it } from "vitest";
import {
    buildSummary,
    dbError,
    validateAckBody,
    isDate,
    newSubtasks,
    pickOrg,
    validateScheduleCreate,
    validateSchedulePatch,
    validateSubtasksBody,
    validateTaskCreate,
    validateTaskPatch,
} from "./v1";
import { approveRefine } from "@/lib/schedule";
import { ScheduleSubtask } from "@/types";

const U = "11111111-2222-3333-4444-555555555555";

describe("validateTaskCreate", () => {
    it("applies defaults and trims", () => {
        expect(validateTaskCreate({ title: "  Fix login " })).toEqual({
            ok: true,
            value: { title: "Fix login", description: undefined, projectId: undefined, status: "ideas", priority: "medium", organizationId: undefined },
        });
    });
    it("rejects bad fields", () => {
        expect(validateTaskCreate({})).toMatchObject({ ok: false, error: expect.stringContaining("title") });
        expect(validateTaskCreate({ title: " " }).ok).toBe(false);
        expect(validateTaskCreate({ title: "x".repeat(201) }).ok).toBe(false);
        expect(validateTaskCreate({ title: "x", status: "todo" }).ok).toBe(false);
        expect(validateTaskCreate({ title: "x", priority: "urgent" }).ok).toBe(false);
        expect(validateTaskCreate({ title: "x", projectId: "abc" }).ok).toBe(false);
        expect(validateTaskCreate({ title: "x", description: 3 }).ok).toBe(false);
        expect(validateTaskCreate(null).ok).toBe(false);
        expect(validateTaskCreate([]).ok).toBe(false);
    });
});

describe("validateTaskPatch", () => {
    it("needs at least one field, allows projectId null", () => {
        expect(validateTaskPatch({}).ok).toBe(false);
        expect(validateTaskPatch({ projectId: null })).toMatchObject({ ok: true, value: { projectId: null } });
        expect(validateTaskPatch({ status: "code_review", description: "" })).toMatchObject({ ok: true, value: { status: "code_review", description: "" } });
        expect(validateTaskPatch({ status: "nope" }).ok).toBe(false);
    });
});

describe("schedule validators", () => {
    it("create: defaults, date and subtasks limits", () => {
        expect(validateScheduleCreate({ title: "flowos" })).toMatchObject({ ok: true, value: { scope: "day", subtasks: [] } });
        expect(validateScheduleCreate({ title: "x", date: "2026-02-30" }).ok).toBe(false);
        expect(validateScheduleCreate({ title: "x", date: "2026-10-23", scope: "week" }).ok).toBe(true);
        expect(validateScheduleCreate({ title: "x", subtasks: Array(21).fill("a") }).ok).toBe(false);
        expect(validateScheduleCreate({ title: "x", subtasks: ["x".repeat(301)] }).ok).toBe(false);
        expect(validateScheduleCreate({ title: "x", subtasks: [""] }).ok).toBe(false);
    });
    it("patch: status enum, date or null", () => {
        expect(validateSchedulePatch({ status: "doing", date: null })).toMatchObject({ ok: true, value: { status: "doing", date: null } });
        expect(validateSchedulePatch({ status: "in_progress" }).ok).toBe(false);
        expect(validateSchedulePatch({}).ok).toBe(false);
    });
    it("subtasks body", () => {
        expect(validateSubtasksBody({ texts: [" a "] })).toEqual({ ok: true, value: { texts: ["a"], queue: false } });
        expect(validateSubtasksBody({ texts: [] }).ok).toBe(false);
        expect(validateSubtasksBody({ texts: Array(20).fill("a"), queue: true }).ok).toBe(true);
        expect(validateSubtasksBody({ texts: Array(21).fill("a") }).ok).toBe(false);
        expect(validateSubtasksBody({ texts: ["a"], queue: "yes" }).ok).toBe(false);
    });
    it("isDate", () => {
        expect(isDate("2026-10-23")).toBe(true);
        expect(isDate("2026-13-01")).toBe(false);
        expect(isDate("23/10/2026")).toBe(false);
    });
});

describe("pickOrg", () => {
    it("uses the given org only if the caller is in it, else the single org", () => {
        expect(pickOrg(["a"], undefined)).toEqual({ orgId: "a" });
        expect(pickOrg(["a", "b"], "b")).toEqual({ orgId: "b" });
        expect(pickOrg(["a", "b"], undefined)).toMatchObject({ status: 400 });
        expect(pickOrg(["a"], U)).toMatchObject({ status: 404 });
    });
});

describe("newSubtasks / approveRefine", () => {
    it("queues new subtasks only when asked", () => {
        let n = 0;
        expect(newSubtasks(["a"], null, () => `n${++n}`, "now")).toEqual([{ id: "n1", text: "a", done: false }]);
        expect(newSubtasks(["b"], "m1", () => "x", "now")[0].agent).toEqual({ status: "queued", requestedBy: "m1", updatedAt: "now" });
    });
    it("approve queues open, untouched proposed subtasks", () => {
        const subs: ScheduleSubtask[] = [
            { id: "p1", text: "open", done: false },
            { id: "p2", text: "done", done: true },
            { id: "p3", text: "has agent", done: false, agent: { status: "failed", requestedBy: "m0" } },
            { id: "mine", text: "manual", done: false },
        ];
        const r = approveRefine(subs, { status: "ready", requestedBy: "m0", subtaskIds: ["p1", "p2", "p3"], updatedAt: "t" }, "m1", "now");
        expect(r.map((s) => s.agent?.status ?? null)).toEqual(["queued", null, "failed", null]);
        expect(r[0].agent).toEqual({ status: "queued", requestedBy: "m1", updatedAt: "now" });
    });
});

describe("buildSummary", () => {
    it("counts agent subtasks, refines and kanban tasks, capping lists", () => {
        const cards = [
            {
                id: "c1", title: "flowos", date: "2026-10-23", refine: { status: "ready" },
                subtasks: [
                    { id: "s1", text: "q", done: false, agent: { status: "queued", requestedBy: "m" } },
                    { id: "s2", text: "d", done: true, doneAt: "2026-10-23", agent: { status: "done", requestedBy: "m" } },
                    { id: "s3", text: "old", done: true, doneAt: "2026-10-01", agent: { status: "done", requestedBy: "m" } },
                    { id: "s4", text: "manual", done: false },
                ],
            },
            { id: "c2", title: "habblaud", date: null, refine: null, subtasks: null },
        ];
        const tasks: { id: string; code: string | null; title: string; status: string; project_id: string | null }[] = Array.from({ length: 25 }, (_, i) => ({ id: `t${i}`, code: null, title: `T${i}`, status: "ideas", project_id: "p1" }));
        tasks.push({ id: "tb", code: "X-1", title: "B", status: "backlog", project_id: null });
        const s = buildSummary(cards, tasks, new Map([["p1", "App"]]), "2026-10-23");
        expect(s.subtasks.queued).toEqual({ count: 1, items: [{ id: "s1", cardId: "c1", title: "q", project: "flowos" }] });
        expect(s.subtasks.doneToday.count).toBe(1);
        expect(s.subtasks.running.count).toBe(0);
        expect(s.refines.ready.items).toEqual([{ id: "c1", title: "flowos", date: "2026-10-23" }]);
        expect(s.tasks.ideas.count).toBe(25);
        expect(s.tasks.ideas.items).toHaveLength(20);
        expect(s.tasks.ideas.items[0].project).toBe("App");
        expect(s.tasks.backlog.items[0]).toEqual({ id: "tb", code: "X-1", title: "B", project: null });
    });
});

describe("inbox ack / db errors", () => {
    it("validates the ack body", () => {
        expect(validateAckBody(null)).toEqual({ ok: true, value: { reply: undefined } });
        expect(validateAckBody({ reply: " feito " })).toEqual({ ok: true, value: { reply: "feito" } });
        expect(validateAckBody({ reply: "x".repeat(3000) }).ok).toBe(true);
        expect(validateAckBody({ reply: "x".repeat(3001) }).ok).toBe(false);
        expect(validateAckBody({ reply: 1 }).ok).toBe(false);
    });
    it("maps NOT NULL on project_id to 400", () => {
        expect(dbError({ code: "23502", message: 'null value in column "project_id" of relation "tasks" violates not-null constraint' })).toEqual({ error: "projectId required", status: 400 });
        expect(dbError({ code: "23502", message: 'null value in column "x"' }).status).toBe(400);
        expect(dbError({ code: "XX000", message: "boom" })).toEqual({ error: "boom", status: 500 });
    });
});
