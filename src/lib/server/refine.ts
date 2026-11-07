import { RISK_LEVELS } from "./v1";
import { ScheduleItem, ScheduleRefine, ScheduleSubtask } from "@/types";

export const REFINE_STATUSES = ["running", "ready", "failed"] as const;

export interface RefineBody {
    email: string;
    cardId: string;
    status: (typeof REFINE_STATUSES)[number];
    plan?: string;
    questions: string[];
    subtasks: string[];
    risks?: { risk: (typeof RISK_LEVELS)[number]; riskWhy?: string }[]; // one per subtask, same order
    error?: string;
}

const strList = (v: unknown, max: number, len: number): string[] | null => {
    if (v === undefined) return [];
    if (!Array.isArray(v) || v.length > max) return null;
    if (!v.every((x) => typeof x === "string" && x.length <= len)) return null;
    return v.map((x: string) => x.trim()).filter(Boolean);
};

/** Validates the POST /api/agent-tasks/refine body; returns the clean body or an error message (-> 400). */
export function validateRefineBody(body: unknown): { ok: true; value: RefineBody } | { ok: false; error: string } {
    const b = (body ?? {}) as Record<string, unknown>;
    const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
    if (!email || typeof b.cardId !== "string" || !b.cardId || !REFINE_STATUSES.includes(b.status as never)) {
        return { ok: false, error: "email, cardId and status (running|ready|failed) are required" };
    }
    if (b.plan !== undefined && (typeof b.plan !== "string" || b.plan.length > 8000)) return { ok: false, error: "plan must be a string up to 8000 chars" };
    if (b.error !== undefined && (typeof b.error !== "string" || b.error.length > 2000)) return { ok: false, error: "error must be a string up to 2000 chars" };
    const questions = strList(b.questions, 10, 500);
    if (!questions) return { ok: false, error: "questions must be up to 10 strings of up to 500 chars" };
    const subtasks = strList(b.subtasks, 20, 300);
    if (!subtasks) return { ok: false, error: "subtasks must be up to 20 strings of up to 300 chars" };
    let risks: RefineBody["risks"];
    if (b.risks !== undefined) {
        const r = b.risks;
        if (!Array.isArray(r) || r.length > 20) return { ok: false, error: "risks must be up to 20 objects {risk, riskWhy?}" };
        risks = [];
        for (const x of r) {
            const o = (x ?? {}) as Record<string, unknown>;
            if (!RISK_LEVELS.includes(o.risk as never) || (o.riskWhy !== undefined && (typeof o.riskWhy !== "string" || o.riskWhy.length > 300))) {
                return { ok: false, error: "risks must be up to 20 objects {risk: low|medium|high, riskWhy?: string up to 300 chars}" };
            }
            const why = typeof o.riskWhy === "string" ? o.riskWhy.trim() : "";
            risks.push({ risk: o.risk as (typeof RISK_LEVELS)[number], ...(why ? { riskWhy: why } : {}) });
        }
    }
    return {
        ok: true,
        value: {
            email,
            ...(risks ? { risks } : {}),
            cardId: b.cardId,
            status: b.status as RefineBody["status"],
            plan: typeof b.plan === "string" ? b.plan.trim() : undefined,
            questions,
            subtasks,
            error: typeof b.error === "string" ? b.error.trim() : undefined,
        },
    };
}

/** Drops the previously proposed subtasks the user hasn't touched (not done, no agent), appends the new ones. */
export function mergeRefineReady(
    subtasks: ScheduleSubtask[],
    refine: ScheduleRefine,
    body: Pick<RefineBody, "plan" | "questions" | "subtasks" | "risks">,
    newId: () => string = () => crypto.randomUUID(),
    now = new Date().toISOString()
): { subtasks: ScheduleSubtask[]; refine: ScheduleRefine } {
    const old = new Set(refine.subtaskIds ?? []);
    const added = body.subtasks.map((text, i) => ({ id: newId(), text, done: false, ...body.risks?.[i] }));
    return {
        subtasks: [...subtasks.filter((s) => !(old.has(s.id) && !s.done && !s.agent)), ...added],
        refine: {
            status: "ready",
            requestedBy: refine.requestedBy,
            plan: body.plan,
            questions: body.questions,
            subtaskIds: added.map((s) => s.id),
            updatedAt: now,
        },
    };
}

/** Cards with a queued refine requested by one of the caller's member ids (GET /api/agent-tasks `refines`). */
export function pendingRefines(
    cards: { id: string; title: string; date: string | null; description?: string | null; subtasks: unknown; refine: unknown }[],
    memberIds: Set<string>
) {
    return cards
        .filter((c) => {
            const r = c.refine as ScheduleItem["refine"];
            return r?.status === "queued" && memberIds.has(r.requestedBy);
        })
        .map((c) => ({
            cardId: c.id,
            cardTitle: c.title,
            date: c.date,
            description: c.description ?? "",
            subtasks: (Array.isArray(c.subtasks) ? (c.subtasks as ScheduleSubtask[]) : []).map((s) => s.text),
        }));
}
