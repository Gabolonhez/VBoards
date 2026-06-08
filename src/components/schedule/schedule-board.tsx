"use client";

import { useState } from "react";
import {
    DndContext,
    DragEndEvent,
    useSensor,
    useSensors,
    PointerSensor,
    useDroppable,
} from "@dnd-kit/core";
import { ScheduleItem, ScheduleStatus, TeamMember } from "@/types";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";
import { ScheduleCard } from "./schedule-card";
import { Input } from "@/components/ui/input";

interface ScheduleBoardProps {
    items: ScheduleItem[];
    members: TeamMember[];
    onCreate: (status: ScheduleStatus, title: string) => void;
    onUpdate: (id: string, updates: Partial<ScheduleItem>) => void;
    onDelete: (id: string) => void;
    onStatusChange: (id: string, status: ScheduleStatus) => void;
}

const COLUMNS: { id: ScheduleStatus; titleKey: string; dot: string }[] = [
    { id: "todo", titleKey: "schedule.todo", dot: "bg-stone-400" },
    { id: "doing", titleKey: "schedule.doing", dot: "bg-amber-400" },
    { id: "done", titleKey: "schedule.done", dot: "bg-emerald-400" },
];

function BoardColumn({
    id,
    title,
    dot,
    items,
    members,
    onCreate,
    onUpdate,
    onDelete,
}: {
    id: ScheduleStatus;
    title: string;
    dot: string;
    items: ScheduleItem[];
    members: TeamMember[];
    onCreate: (status: ScheduleStatus, title: string) => void;
    onUpdate: (id: string, updates: Partial<ScheduleItem>) => void;
    onDelete: (id: string) => void;
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
                    />
                ))}

                {id === "todo" && (
                    adding ? (
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
                            onClick={() => setAdding(true)}
                            className="w-full text-center text-sm text-muted-foreground border border-dashed border-border rounded-md py-2 hover:text-foreground hover:border-primary/40 transition-colors"
                        >
                            {t("schedule.new_item")}
                        </button>
                    )
                )}
            </div>
        </div>
    );
}

export function ScheduleBoard({ items, members, onCreate, onUpdate, onDelete, onStatusChange }: ScheduleBoardProps) {
    const { t } = useLanguage();

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over) return;
        const itemId = active.id as string;
        const newStatus = over.id as ScheduleStatus;
        const current = items.find((i) => i.id === itemId);
        if (current && current.status !== newStatus) {
            onStatusChange(itemId, newStatus);
        }
    }

    return (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="flex h-full gap-6 overflow-x-auto pb-4">
                {COLUMNS.map((col) => (
                    <BoardColumn
                        key={col.id}
                        id={col.id}
                        title={t(col.titleKey)}
                        dot={col.dot}
                        items={items.filter((i) => i.status === col.id)}
                        members={members}
                        onCreate={onCreate}
                        onUpdate={onUpdate}
                        onDelete={onDelete}
                    />
                ))}
            </div>
        </DndContext>
    );
}
