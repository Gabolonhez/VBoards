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

export interface DaySummaryGroup {
    project: string;
    entries: { text: string; assignee?: string }[];
}

// What got done on a given day, grouped by card — a card is the project, its subtasks the work. Subtasks
// count by their own doneAt, so month/week cards contribute too. A day card with no subtasks has nothing
// finer to report, so the card itself goes under the fallback group once it is Done on that day.
export function buildDaySummary(items: ScheduleItem[], day: string, fallbackGroup: string): DaySummaryGroup[] {
    const groups = new Map<string, DaySummaryGroup>();
    const add = (project: string, text: string, assignee?: string) => {
        const key = project.trim().toLowerCase();
        if (!groups.has(key)) groups.set(key, { project: project.trim(), entries: [] });
        groups.get(key)!.entries.push({ text: text.trim(), assignee });
    };

    for (const item of items) {
        const assignee = item.assignee ? item.assignee.nickname || item.assignee.name : undefined;
        const subtasks = item.subtasks || [];
        if (subtasks.length > 0) {
            subtasks.filter((s) => s.done && s.doneAt === day).forEach((s) => add(item.title, s.text, assignee));
        } else if (item.scope === "day" && item.status === "done" && item.date === day) {
            add(fallbackGroup, item.title, assignee);
        }
    }

    // Fallback group goes last, after the real projects
    const fallbackKey = fallbackGroup.trim().toLowerCase();
    return [...groups.entries()]
        .sort(([a], [b]) => (a === fallbackKey ? 1 : 0) - (b === fallbackKey ? 1 : 0))
        .map(([, g]) => g);
}

// Plain text ready to paste in WhatsApp / Slack (both read *x* as bold). Names are only tagged when the
// summary mixes more than one person — a personal summary doesn't need them.
export function formatDaySummary(groups: DaySummaryGroup[], header: string): string {
    const people = new Set(groups.flatMap((g) => g.entries.map((e) => e.assignee).filter(Boolean)));
    const tagNames = people.size > 1;
    const blocks = groups.map((g) => {
        const lines = g.entries.map((e) => `• ${e.text}${tagNames && e.assignee ? ` (${e.assignee})` : ""}`);
        return [`*${g.project}*`, ...lines].join("\n");
    });
    return [`*${header}*`, ...blocks].join("\n\n");
}
