import { ScheduleRefine, ScheduleSubtask } from "@/types";

// Pure logic of the /api/v1 routes (validation, org choice, row mapping, summary). No I/O here.

export const TASK_STATUSES = ["ideas", "backlog", "in_progress", "code_review", "done", "deployed"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export const TASK_ORIGINS = ["research"] as const;
export const RISK_LEVELS = ["low", "medium", "high"] as const;
// Pipeline steps the Habblaud runner reports (its JOURNAL_STAGES)
export const PIPELINE_STAGES = ["queued", "running", "review", "pr", "ci_fail", "merged", "deployed", "failed", "discarded", "triaged", "ota_preview", "ota_production", "build", "submitted", "auto"] as const;
export const TRIAGE_PRIORITIES = ["low", "med", "high"] as const;
export const SCHEDULE_SCOPES = ["month", "week", "day"] as const;
export const SCHEDULE_STATUSES = ["todo", "doing", "done"] as const;

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
type Check = (v: unknown) => boolean;

export const isUuid = (v: unknown): v is string =>
    typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const isDate = (v: unknown): v is string =>
    typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().startsWith(v);
const text = (max: number, min = 0): Check => (v) => typeof v === "string" && v.trim().length >= min && v.length <= max;
const oneOf = (list: readonly string[]): Check => (v) => typeof v === "string" && list.includes(v);
const orNull = (c: Check): Check => (v) => v === null || c(v);
const texts = (maxItems: number, maxLen: number, minItems = 0): Check => (v) =>
    Array.isArray(v) && v.length >= minItems && v.length <= maxItems && v.every((x) => typeof x === "string" && x.trim().length > 0 && x.length <= maxLen);

class Invalid extends Error {}

/** Runs `fn` with a field reader; the first invalid field becomes the 400 message. Unknown keys are ignored. */
function validate<T>(body: unknown, fn: (get: (key: string, check: Check, msg: string, required?: boolean) => unknown) => T): Result<T> {
    if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "a JSON object body is required" };
    const b = body as Record<string, unknown>;
    const get = (key: string, check: Check, msg: string, required = false) => {
        const v = b[key];
        if (v === undefined) {
            if (required) throw new Invalid(`${key} is required (${msg})`);
            return undefined;
        }
        if (!check(v)) throw new Invalid(`${key} must be ${msg}`);
        return typeof v === "string" ? v.trim() : Array.isArray(v) ? v.map((x: string) => x.trim()) : v;
    };
    try {
        return { ok: true, value: fn(get) };
    } catch (e) {
        if (e instanceof Invalid) return { ok: false, error: e.message };
        throw e;
    }
}

const TITLE = "a string of 1-200 chars";
const DESC = "a string up to 10000 chars";
const UUID = "a uuid";
const nonEmpty = <T extends object>(v: T): T => {
    if (!Object.values(v).some((x) => x !== undefined)) throw new Invalid("no fields to update");
    return v;
};

/** https://github.com/<owner>/<repo>/pull/<n>, nothing else (the link is rendered/clicked by people). */
export const isPrUrl = (v: unknown): v is string => {
    if (typeof v !== "string" || v.length > 300) return false;
    try {
        const u = new URL(v);
        return u.protocol === "https:" && u.hostname === "github.com" && !u.username && !u.port && /^\/[\w.-]+\/[\w.-]+\/pull\/\d+\/?$/.test(u.pathname);
    } catch {
        return false;
    }
};

/** Optional `stage` / `prUrl` of POST /api/agent-tasks/update. */
export const validateAgentExtras = (body: unknown): Result<{ stage?: string; prUrl?: string }> =>
    validate(body, (get) => ({
        stage: get("stage", oneOf(PIPELINE_STAGES), PIPELINE_STAGES.join("|")) as string | undefined,
        prUrl: get("prUrl", isPrUrl, "an https://github.com/<owner>/<repo>/pull/<n> url") as string | undefined,
    }));

export interface Triage {
    valid: boolean;
    reason: string;
    duplicateOf?: string;
    alreadyDone?: boolean;
    product?: string;
    repo?: string;
    priority?: (typeof TRIAGE_PRIORITIES)[number];
    risk?: (typeof RISK_LEVELS)[number];
    riskWhy?: string;
    questions: string[];
    at?: number;
}
/** Cleans the `triage` object Habblaud puts on a task: known keys only, strings bounded; null = invalid. */
export function parseTriage(v: unknown): Triage | null {
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const o = v as Record<string, unknown>;
    const opt = (k: string, max: number): string | undefined | null => {
        if (o[k] === undefined) return undefined;
        return typeof o[k] === "string" && (o[k] as string).length <= max ? (o[k] as string).trim() || undefined : null;
    };
    const duplicateOf = opt("duplicateOf", 100), product = opt("product", 100), repo = opt("repo", 200), riskWhy = opt("riskWhy", 500);
    const reason = opt("reason", 500);
    if (typeof o.valid !== "boolean" || !reason || duplicateOf === null || product === null || repo === null || riskWhy === null) return null;
    if (o.alreadyDone !== undefined && typeof o.alreadyDone !== "boolean") return null;
    if (o.priority !== undefined && !oneOf(TRIAGE_PRIORITIES)(o.priority)) return null;
    if (o.risk !== undefined && !oneOf(RISK_LEVELS)(o.risk)) return null;
    if (o.at !== undefined && !Number.isFinite(o.at)) return null;
    const questions = o.questions === undefined ? [] : o.questions;
    if (!texts(10, 500)(questions)) return null;
    return {
        valid: o.valid,
        reason,
        ...(duplicateOf ? { duplicateOf } : {}),
        ...(o.alreadyDone !== undefined ? { alreadyDone: o.alreadyDone as boolean } : {}),
        ...(product ? { product } : {}),
        ...(repo ? { repo } : {}),
        ...(o.priority !== undefined ? { priority: o.priority as Triage["priority"] } : {}),
        ...(o.risk !== undefined ? { risk: o.risk as Triage["risk"] } : {}),
        ...(riskWhy ? { riskWhy } : {}),
        questions: (questions as string[]).map((q) => q.trim()),
        ...(o.at !== undefined ? { at: o.at as number } : {}),
    };
}

export interface TaskCreate {
    title: string;
    description?: string;
    projectId?: string;
    status: (typeof TASK_STATUSES)[number];
    priority: (typeof TASK_PRIORITIES)[number];
    organizationId?: string;
    origin?: (typeof TASK_ORIGINS)[number];
}
export const validateTaskCreate = (body: unknown): Result<TaskCreate> =>
    validate(body, (get) => ({
        title: get("title", text(200, 1), TITLE, true) as string,
        description: get("description", text(10000), DESC) as string | undefined,
        projectId: get("projectId", isUuid, UUID) as string | undefined,
        status: (get("status", oneOf(TASK_STATUSES), TASK_STATUSES.join("|")) ?? "ideas") as TaskCreate["status"],
        priority: (get("priority", oneOf(TASK_PRIORITIES), TASK_PRIORITIES.join("|")) ?? "medium") as TaskCreate["priority"],
        organizationId: get("organizationId", isUuid, UUID) as string | undefined,
        origin: get("origin", oneOf(TASK_ORIGINS), TASK_ORIGINS.join("|")) as TaskCreate["origin"],
    }));

export interface TaskPatch {
    title?: string;
    description?: string;
    status?: TaskCreate["status"];
    priority?: TaskCreate["priority"];
    projectId?: string | null;
    triage?: Triage;
}
export const validateTaskPatch = (body: unknown): Result<TaskPatch> =>
    validate(body, (get) =>
        nonEmpty({
            title: get("title", text(200, 1), TITLE) as string | undefined,
            description: get("description", text(10000), DESC) as string | undefined,
            status: get("status", oneOf(TASK_STATUSES), TASK_STATUSES.join("|")) as TaskPatch["status"],
            priority: get("priority", oneOf(TASK_PRIORITIES), TASK_PRIORITIES.join("|")) as TaskPatch["priority"],
            projectId: get("projectId", orNull(isUuid), "a uuid or null") as string | null | undefined,
            triage: get("triage", (x) => parseTriage(x) !== null, "an object {valid, reason, questions, ...} within limits") === undefined ? undefined : parseTriage(body && (body as Record<string, unknown>).triage)!,
        })
    );

export interface ScheduleCreate {
    title: string;
    date?: string;
    scope: (typeof SCHEDULE_SCOPES)[number];
    description?: string;
    subtasks: string[];
    organizationId?: string;
}
export const validateScheduleCreate = (body: unknown): Result<ScheduleCreate> =>
    validate(body, (get) => ({
        title: get("title", text(200, 1), TITLE, true) as string,
        date: get("date", isDate, "YYYY-MM-DD") as string | undefined,
        scope: (get("scope", oneOf(SCHEDULE_SCOPES), SCHEDULE_SCOPES.join("|")) ?? "day") as ScheduleCreate["scope"],
        description: get("description", text(10000), DESC) as string | undefined,
        subtasks: (get("subtasks", texts(20, 300), "up to 20 non-empty strings of up to 300 chars") ?? []) as string[],
        organizationId: get("organizationId", isUuid, UUID) as string | undefined,
    }));

export interface SchedulePatch {
    title?: string;
    description?: string;
    status?: (typeof SCHEDULE_STATUSES)[number];
    date?: string | null;
}
export const validateSchedulePatch = (body: unknown): Result<SchedulePatch> =>
    validate(body, (get) =>
        nonEmpty({
            title: get("title", text(200, 1), TITLE) as string | undefined,
            description: get("description", text(10000), DESC) as string | undefined,
            status: get("status", oneOf(SCHEDULE_STATUSES), SCHEDULE_STATUSES.join("|")) as SchedulePatch["status"],
            date: get("date", orNull(isDate), "YYYY-MM-DD or null") as string | null | undefined,
        })
    );

export const validateSubtasksBody = (body: unknown): Result<{ texts: string[]; queue: boolean }> =>
    validate(body, (get) => ({
        texts: get("texts", texts(20, 300, 1), "1-20 non-empty strings of up to 300 chars", true) as string[],
        queue: (get("queue", (v) => typeof v === "boolean", "a boolean") ?? false) as boolean,
    }));

/** Target organization of a create: the given one if the caller belongs to it, else the only one. */
export function pickOrg(orgIds: string[], organizationId?: string): { orgId: string } | { error: string; status: 400 | 404 } {
    if (organizationId) return orgIds.includes(organizationId) ? { orgId: organizationId } : { error: "organization not found", status: 404 };
    if (orgIds.length === 1) return { orgId: orgIds[0] };
    return { error: "organizationId is required (you belong to several organizations)", status: 400 };
}

type Row = Record<string, unknown>;

export const mapTask = (t: Row) => ({
    id: t.id,
    code: t.code,
    title: t.title,
    description: t.description ?? null,
    status: t.status,
    priority: t.priority,
    type: t.type ?? null,
    projectId: t.project_id ?? null,
    organizationId: t.organization_id,
    versionId: t.version_id ?? null,
    origin: t.origin ?? null,
    triage: t.triage ?? null,
    assigneeId: t.assignee_id ?? null,
    createdAt: t.created_at,
    updatedAt: t.updated_at ?? null,
});

export const mapProject = (p: Row) => ({
    id: p.id,
    name: p.name,
    prefix: p.prefix ?? null,
    color: p.color ?? null,
    organizationId: p.organization_id,
    createdAt: p.created_at,
});

/** New subtasks appended to a card; queue=true hands them to the agent as `memberId`. */
export function newSubtasks(texts: string[], queueAs: string | null, newId: () => string = () => crypto.randomUUID(), now = new Date().toISOString()): ScheduleSubtask[] {
    return texts.map((text) => ({
        id: newId(),
        text,
        done: false,
        ...(queueAs ? { agent: { status: "queued" as const, requestedBy: queueAs, updatedAt: now } } : {}),
    }));
}

export const SUMMARY_CAP = 20;
const bucket = <T>(items: T[]) => ({ count: items.length, items: items.slice(0, SUMMARY_CAP) });

interface SummaryCard { id: string; title: string; date: string | null; subtasks: unknown; refine: unknown }
interface SummaryTask { id: string; code: string | null; title: string; status: string; project_id: string | null }

/** GET /api/v1/summary: what a briefing needs, counts plus the first SUMMARY_CAP of each list. */
export function buildSummary(cards: SummaryCard[], tasks: SummaryTask[], projectNames: Map<string, string>, date: string) {
    const subs = cards.flatMap((c) =>
        (Array.isArray(c.subtasks) ? (c.subtasks as ScheduleSubtask[]) : [])
            .filter((s) => s.agent)
            .map((s) => ({ s, item: { id: s.id, cardId: c.id, title: s.text, project: c.title } }))
    );
    const agent = (status: string) => bucket(subs.filter((x) => x.s.agent!.status === status).map((x) => x.item));
    const refine = (status: ScheduleRefine["status"]) =>
        bucket(cards.filter((c) => (c.refine as ScheduleRefine | null)?.status === status).map((c) => ({ id: c.id, title: c.title, date: c.date })));
    const kanban = (status: string) =>
        bucket(tasks.filter((t) => t.status === status).map((t) => ({
            id: t.id,
            code: t.code,
            title: t.title,
            project: t.project_id ? projectNames.get(t.project_id) ?? null : null,
        })));
    return {
        date,
        subtasks: {
            queued: agent("queued"),
            running: agent("running"),
            review: agent("review"),
            failed: agent("failed"),
            doneToday: bucket(subs.filter((x) => x.s.agent!.status === "done" && x.s.doneAt === date).map((x) => x.item)),
        },
        refines: { queued: refine("queued"), running: refine("running"), ready: refine("ready"), failed: refine("failed") },
        tasks: { ideas: kanban("ideas"), backlog: kanban("backlog"), in_progress: kanban("in_progress"), code_review: kanban("code_review") },
    };
}

/** POST /api/v1/jarvis/inbox/:id/ack. An empty body is fine. */
export const validateAckBody = (body: unknown): Result<{ reply?: string }> =>
    validate(body ?? {}, (get) => ({ reply: get("reply", text(3000), "a string up to 3000 chars") as string | undefined }));

/** DB error -> API error. NOT NULL (23502) is the client's fault: tasks.project_id may be required by the schema. */
export function dbError(error: { code?: string; message: string }): { error: string; status: 400 | 500 } {
    if (error.code === "23502") return { error: /project_id/.test(error.message) ? "projectId required" : error.message, status: 400 };
    return { error: error.message, status: 500 };
}
