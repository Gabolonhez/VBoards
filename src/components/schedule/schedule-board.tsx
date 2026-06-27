"use client";

import { useState } from "react";
import {
    DndContext,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
    closestCorners,
    useSensor,
    useSensors,
    PointerSensor,
    useDroppable,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ScheduleItem, ScheduleStatus, TeamMember } from "@/types";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";
import { ScheduleCard } from "./schedule-card";
import { Input } from "@/components/ui/input";

export interface ScheduleReorderUpdate {
    id: string;
    status: ScheduleStatus;
    position: number;
}

interface ScheduleBoardProps {
    items: ScheduleItem[];
    members: TeamMember[];
    onCreate: (status: ScheduleStatus, title: string) => void;
    onUpdate: (id: string, updates: Partial<ScheduleItem>) => void;
    onDelete: (id: string) => void;
    onReorder: (updates: ScheduleReorderUpdate[]) => void;
    selectedIds: string[];
    onToggleSelect: (id: string) => void;
}

const COLUMNS: { id: ScheduleStatus; titleKey: string; dot: string }[] = [
    { id: "todo", titleKey: "schedule.todo", dot: "bg-stone-400" },
    { id: "doing", titleKey: "schedule.doing", dot: "bg-amber-400" },
    { id: "done", titleKey: "schedule.done", dot: "bg-emerald-400" },
];

function byPosition(a: ScheduleItem, b: ScheduleItem) {
    return (a.position ?? 0) - (b.position ?? 0);
}

function BoardColumn({
    id,
    title,
    dot,
    items,
    members,
    onCreate,
    onUpdate,
    onDelete,
    selectedIds,
    onToggleSelect,
}: {
    id: ScheduleStatus;
    title: string;
    dot: string;
    items: ScheduleItem[];
    members: TeamMember[];
    onCreate: (status: ScheduleStatus, title: string) => void;
    onUpdate: (id: string, updates: Partial<ScheduleItem>) => void;
    onDelete: (id: string) => void;
    selectedIds: string[];
    onToggleSelect: (id: string) => void;
}) {
    const { t } = useLanguage();
    const { setNodeRef, isOver } = useDroppable({ id });
    const [adding, setAdding] = useState(false);
    const [title2, setTitle2] = useState("");

    const submit = () => {
        const value = title2.trim();
        if (value) onCreate(id, value);
        setTitle2("");
        setAdding(false);
    };

    return (
        <div className="flex flex-col h-full min-w-[320px] flex-1">
            <div className="flex items-center gap-2 mb-3 px-1">
                <span className={cn("h-2 w-2 rounded-full", dot)} />
                <h3 className="font-semibold text-xs tracking-widest text-muted-foreground uppercase">
                    {title}
                </h3>
                <span className="text-xs text-muted-foreground/70">({items.length})</span>
            </div>

            <div
                ref={setNodeRef}
                className={cn(
                    "flex-1 rounded-lg p-2 space-y-2 overflow-y-auto no-scrollbar border-t-2 border-border/40 transition-colors",
                    isOver && "bg-primary/5 border-primary/40"
                )}
            >
                <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    {items.length === 0 && !adding && (
                        <p className="text-sm text-muted-foreground/50 px-2 py-1">{t("schedule.empty_column")}</p>
                    )}

                    {items.map((item) => (
                        <ScheduleCard
                            key={item.id}
                            item={item}
                            members={members}
                            onUpdate={onUpdate}
                            onDelete={onDelete}
                            selected={selectedIds.includes(item.id)}
                            onToggleSelect={onToggleSelect}
                        />
                    ))}
                </SortableContext>

                {id === "todo" &&
                    (adding ? (
                        <Input
                            autoFocus
                            value={title2}
                            onChange={(e) => setTitle2(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") submit();
                                if (e.key === "Escape") {
                                    setTitle2("");
                                    setAdding(false);
                                }
                            }}
                            onBlur={submit}
                            placeholder={t("schedule.new_item_placeholder")}
                            className="h-9 text-sm"
                        />
                    ) : (
                        <button
                            type="button"
                            onClick={() => setAdding(true)}
                            className="w-full text-center text-sm text-muted-foreground border border-dashed border-border rounded-md py-2 hover:text-foreground hover:border-primary/40 transition-colors"
                        >
                            {t("schedule.new_item")}
                        </button>
                    ))}
            </div>
        </div>
    );
}

export function ScheduleBoard({ items, members, onCreate, onUpdate, onDelete, onReorder, selectedIds, onToggleSelect }: ScheduleBoardProps) {
    const { t } = useLanguage();
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    const columnItems = (status: ScheduleStatus) => items.filter((i) => i.status === status).sort(byPosition);

    function handleDragStart(event: DragStartEvent) {
        setActiveId(event.active.id as string);
    }

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        setActiveId(null);
        if (!over) return;

        const activeItem = items.find((i) => i.id === active.id);
        if (!activeItem) return;

        const overId = over.id as string;
        const isColumn = COLUMNS.some((c) => c.id === overId);
        const overItem = items.find((i) => i.id === overId);
        const targetStatus = (isColumn ? (overId as ScheduleStatus) : overItem?.status) as ScheduleStatus | undefined;
        if (!targetStatus) return;

        // No-op: dropped on itself, same column same neighbour
        if (overId === active.id) return;

        const targetList = columnItems(targetStatus).filter((i) => i.id !== activeItem.id);
        let insertIndex = targetList.length;
        if (overItem && !isColumn) {
            const idx = targetList.findIndex((i) => i.id === overItem.id);
            insertIndex = idx < 0 ? targetList.length : idx;
        }

        const newColumn = [
            ...targetList.slice(0, insertIndex),
            activeItem,
            ...targetList.slice(insertIndex),
        ];

        const updates: ScheduleReorderUpdate[] = newColumn.map((it, idx) => ({
            id: it.id,
            status: targetStatus,
            position: idx,
        }));

        // Re-index source column when moving across columns
        if (activeItem.status !== targetStatus) {
            columnItems(activeItem.status)
                .filter((i) => i.id !== activeItem.id)
                .forEach((it, idx) => updates.push({ id: it.id, status: activeItem.status, position: idx }));
        }

        onReorder(updates);
    }

    const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="flex h-full gap-6 overflow-x-auto pb-4">
                {COLUMNS.map((col) => (
                    <BoardColumn
                        key={col.id}
                        id={col.id}
                        title={t(col.titleKey)}
                        dot={col.dot}
                        items={columnItems(col.id)}
                        members={members}
                        onCreate={onCreate}
                        onUpdate={onUpdate}
                        onDelete={onDelete}
                        selectedIds={selectedIds}
                        onToggleSelect={onToggleSelect}
                    />
                ))}
            </div>

            <DragOverlay>
                {activeItem ? (
                    <div className="bg-card rounded-md border shadow-lg ring-2 ring-primary px-3 py-3 text-sm font-medium cursor-grabbing">
                        {activeItem.title}
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
