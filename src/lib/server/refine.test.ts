import { describe, expect, it } from "vitest";
import { mergeRefineReady, pendingRefines, validateRefineBody } from "./refine";
import { ScheduleRefine, ScheduleSubtask } from "@/types";

const base = { email: "A@b.com", cardId: "c1", status: "ready" };
const refine: ScheduleRefine = { status: "running", requestedBy: "m1", subtaskIds: ["p1", "p2", "p3", "p4"], updatedAt: "t" };

describe("mergeRefineReady", () => {
    it("drops only untouched proposed subtasks, keeps others, appends new ids", () => {
        const subs: ScheduleSubtask[] = [
            { id: "mine", text: "manual", done: false },
            { id: "p1", text: "untouched", done: false },
            { id: "p2", text: "done", done: true },
            { id: "p3", text: "queued", done: false, agent: { status: "queued", requestedBy: "m1" } },
            { id: "p4", text: "failed agent", done: false, agent: { status: "failed", requestedBy: "m1" } },
        ];
        let n = 0;
        const r = mergeRefineReady(subs, refine, { plan: "plan", questions: ["q?"], subtasks: ["a", "b"] }, () => `n${++n}`, "now");
        expect(r.subtasks.map((s) => s.id)).toEqual(["mine", "p2", "p3", "p4", "n1", "n2"]);
        expect(r.subtasks.slice(-2)).toEqual([{ id: "n1", text: "a", done: false }, { id: "n2", text: "b", done: false }]);
        expect(r.refine).toEqual({ status: "ready", requestedBy: "m1", plan: "plan", questions: ["q?"], subtaskIds: ["n1", "n2"], updatedAt: "now" });
    });
});

describe("validateRefineBody", () => {
    it("accepts a valid body and normalizes email", () => {
        const r = validateRefineBody({ ...base, plan: "p", questions: ["q"], subtasks: ["s"] });
        expect(r).toMatchObject({ ok: true, value: { email: "a@b.com", questions: ["q"], subtasks: ["s"] } });
    });
    it("rejects bad status / missing fields", () => {
        expect(validateRefineBody({ ...base, status: "queued" }).ok).toBe(false);
        expect(validateRefineBody({ ...base, cardId: "" }).ok).toBe(false);
        expect(validateRefineBody(null).ok).toBe(false);
    });
    it("enforces limits", () => {
        expect(validateRefineBody({ ...base, plan: "x".repeat(8000) }).ok).toBe(true);
        expect(validateRefineBody({ ...base, plan: "x".repeat(8001) }).ok).toBe(false);
        expect(validateRefineBody({ ...base, error: "x".repeat(2001) }).ok).toBe(false);
        expect(validateRefineBody({ ...base, questions: Array(10).fill("q") }).ok).toBe(true);
        expect(validateRefineBody({ ...base, questions: Array(11).fill("q") }).ok).toBe(false);
        expect(validateRefineBody({ ...base, questions: ["x".repeat(501)] }).ok).toBe(false);
        expect(validateRefineBody({ ...base, subtasks: Array(20).fill("s") }).ok).toBe(true);
        expect(validateRefineBody({ ...base, subtasks: Array(21).fill("s") }).ok).toBe(false);
        expect(validateRefineBody({ ...base, subtasks: ["x".repeat(301)] }).ok).toBe(false);
        expect(validateRefineBody({ ...base, subtasks: [1] }).ok).toBe(false);
    });
});

describe("pendingRefines", () => {
    const card = (id: string, r: unknown) => ({ id, title: "T" + id, date: "2026-01-01", description: null, subtasks: [{ id: "s", text: "x", done: false }], refine: r });
    it("returns only queued refines requested by the caller", () => {
        const out = pendingRefines(
            [
                card("1", { status: "queued", requestedBy: "m1" }),
                card("2", { status: "queued", requestedBy: "other" }),
                card("3", { status: "running", requestedBy: "m1" }),
                card("4", null),
            ],
            new Set(["m1"])
        );
        expect(out).toEqual([{ cardId: "1", cardTitle: "T1", date: "2026-01-01", description: "", subtasks: ["x"] }]);
    });
});
