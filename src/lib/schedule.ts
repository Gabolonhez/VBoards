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
