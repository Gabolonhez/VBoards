import { ScheduleItem, ScheduleStatus, ScheduleSubtask } from "@/types";

// A card whose subtasks are all checked moves itself to Done, and back out the moment one is reopened
// or a new one is added. Cards with no subtasks are left alone — nothing to infer from, so their column
// stays purely manual.
export function autoStatus(item: ScheduleItem, subtasks: ScheduleSubtask[]): ScheduleStatus | null {
    if (subtasks.length === 0) return null;
    const allDone = subtasks.every((s) => s.done);
    if (allDone && item.status !== "done") return "done";
    if (!allDone && item.status === "done") return "doing";
    return null;
}

export type DaySummaryMode = "done" | "doing" | "both";

interface DaySummaryEntry {
    text: string;
    assignee?: string;
}

export interface DaySummaryGroup {
    project: string;
    done: DaySummaryEntry[];
    doing: DaySummaryEntry[];
}

// What got done (and/or is still in progress) on a given day, grouped by card — a card is the project,
// its subtasks the work. Done subtasks count by their own doneAt, so month/week cards contribute too. In
// progress means a day card in the Doing column for that day: its open subtasks, or the card itself when
// it has none. A day card with no subtasks has nothing finer to report, so it goes under the fallback group.
export function buildDaySummary(
    items: ScheduleItem[],
    day: string,
    fallbackGroup: string,
    mode: DaySummaryMode
): DaySummaryGroup[] {
    const groups = new Map<string, DaySummaryGroup>();
    const add = (project: string, kind: "done" | "doing", text: string, assignee?: string) => {
        const key = project.trim().toLowerCase();
        if (!groups.has(key)) groups.set(key, { project: project.trim(), done: [], doing: [] });
        groups.get(key)![kind].push({ text: text.trim(), assignee });
    };
    const wantDone = mode !== "doing";
    const wantDoing = mode !== "done";

    for (const item of items) {
        const assignee = item.assignee ? item.assignee.nickname || item.assignee.name : undefined;
        const subtasks = item.subtasks || [];
        const doingToday = item.scope === "day" && item.status === "doing" && item.date === day;

        if (subtasks.length > 0) {
            if (wantDone) {
                subtasks.filter((s) => s.done && s.doneAt === day).forEach((s) => add(item.title, "done", s.text, assignee));
            }
            if (wantDoing && doingToday) {
                subtasks.filter((s) => !s.done).forEach((s) => add(item.title, "doing", s.text, assignee));
            }
        } else if (item.scope === "day" && item.date === day) {
            if (wantDone && item.status === "done") add(fallbackGroup, "done", item.title, assignee);
            if (wantDoing && item.status === "doing") add(fallbackGroup, "doing", item.title, assignee);
        }
    }

    // Fallback group goes last, after the real projects
    const fallbackKey = fallbackGroup.trim().toLowerCase();
    return [...groups.entries()]
        .sort(([a], [b]) => (a === fallbackKey ? 1 : 0) - (b === fallbackKey ? 1 : 0))
        .map(([, g]) => g);
}

// Plain text ready to paste in WhatsApp / Slack (both read *x* as bold, _x_ as italic). Names are only
// tagged when the summary mixes more than one person — a personal summary doesn't need them. Done / in
// progress sub-headings are passed only when both were asked for, so a project with one kind still reads right.
export function formatDaySummary(
    groups: DaySummaryGroup[],
    header: string,
    labels: { done: string; doing: string } | null
): string {
    const people = new Set(
        groups.flatMap((g) => [...g.done, ...g.doing].map((e) => e.assignee).filter(Boolean))
    );
    const tagNames = people.size > 1;
    const bullets = (entries: DaySummaryEntry[]) =>
        entries.map((e) => `• ${e.text}${tagNames && e.assignee ? ` (${e.assignee})` : ""}`);

    const blocks = groups.map((g) => {
        if (!labels) return [`*${g.project}*`, ...bullets([...g.done, ...g.doing])].join("\n");
        const lines = [`*${g.project}*`];
        if (g.done.length > 0) lines.push(`_${labels.done}_`, ...bullets(g.done));
        if (g.doing.length > 0) lines.push(`_${labels.doing}_`, ...bullets(g.doing));
        return lines.join("\n");
    });
    return [`*${header}*`, ...blocks].join("\n\n");
}
