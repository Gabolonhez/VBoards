"use client";

import { useState } from "react";
import { DndContext, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useSortable, SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ScheduleItem, ScheduleSubtask, TeamMember } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronRight, GripVertical, Trash, Plus, X, Check, CalendarDays } from "lucide-react";

const LOCALE_MAP: Record<string, string> = { pt: "pt-BR", es: "es-ES", en: "en-US" };

function formatDate(date: string, locale: string) {
    // date is 'YYYY-MM-DD' — parse as local to avoid timezone shift
    const [y, m, d] = date.split("-").map(Number);
    if (!y || !m || !d) return date;
    return new Date(y, m - 1, d).toLocaleDateString(LOCALE_MAP[locale] || "en-US", {
        day: "2-digit",
        month: "short",
    });
}

interface ScheduleCardProps {
    item: ScheduleItem;
    members: TeamMember[];
    onUpdate: (id: string, updates: Partial<ScheduleItem>) => void;
    onDelete: (id: string) => void;
    selected?: boolean;
    onToggleSelect?: (id: string) => void;
}

function SubtaskRow({
    sub,
    onToggle,
    onRemove,
    onEditText,
    removeLabel,
    placeholder,
}: {
    sub: ScheduleSubtask;
    onToggle: (id: string) => void;
    onRemove: (id: string) => void;
    onEditText: (id: string, text: string) => void;
    removeLabel: string;
    placeholder: string;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sub.id });
    const style = { transform: CSS.Translate.toString(transform), transition };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn("flex items-center gap-1.5 group/sub", isDragging && "opacity-60")}
        >
            <button
                type="button"
                aria-label="Reorder"
                {...listeners}
                {...attributes}
                className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground touch-none shrink-0"
            >
                <GripVertical className="h-3.5 w-3.5" />
            </button>
            <Checkbox checked={sub.done} onCheckedChange={() => onToggle(sub.id)} className="h-4 w-4 shrink-0" />
            <input
                defaultValue={sub.text}
                onBlur={(e) => onEditText(sub.id, e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") {
                        (e.target as HTMLInputElement).value = sub.text;
                        (e.target as HTMLInputElement).blur();
                    }
                }}
                title={placeholder}
                aria-label={placeholder}
                className={cn(
                    "text-sm flex-1 bg-transparent outline-none border-b border-transparent focus:border-input transition-colors",
                    sub.done && "line-through text-muted-foreground"
                )}
            />
            <button
                type="button"
                aria-label={removeLabel}
                title={removeLabel}
                onClick={() => onRemove(sub.id)}
                className="opacity-0 group-hover/sub:opacity-100 transition-opacity text-muted-foreground hover:text-red-500 shrink-0"
            >
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

function memberInitial(name?: string) {
    return name?.trim()?.[0]?.toUpperCase() || "?";
}

export function ScheduleCard({ item, members, onUpdate, onDelete, selected, onToggleSelect }: ScheduleCardProps) {
    const { t, language } = useLanguage();
    const [expanded, setExpanded] = useState(false);
    const [newSubtask, setNewSubtask] = useState("");
    const [titleDraft, setTitleDraft] = useState(item.title);

    const saveTitle = () => {
        const value = titleDraft.trim();
        if (value && value !== item.title) {
            onUpdate(item.id, { title: value });
        } else {
            setTitleDraft(item.title);
        }
    };

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: item.id,
        data: item,
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
    };

    const subtasks = item.subtasks || [];
    const doneCount = subtasks.filter((s) => s.done).length;

    const toggleSubtask = (subId: string) => {
        const next = subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done } : s));
        onUpdate(item.id, { subtasks: next });
    };

    const removeSubtask = (subId: string) => {
        onUpdate(item.id, { subtasks: subtasks.filter((s) => s.id !== subId) });
    };

    const updateSubtaskText = (subId: string, text: string) => {
        const value = text.trim();
        const current = subtasks.find((s) => s.id === subId);
        if (!current || !value || value === current.text) return;
        onUpdate(item.id, {
            subtasks: subtasks.map((s) => (s.id === subId ? { ...s, text: value } : s)),
        });
    };

    const subtaskSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    const handleSubtaskDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const oldIndex = subtasks.findIndex((s) => s.id === active.id);
        const newIndex = subtasks.findIndex((s) => s.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return;
        onUpdate(item.id, { subtasks: arrayMove(subtasks, oldIndex, newIndex) });
    };

    const addSubtask = () => {
        const text = newSubtask.trim();
        if (!text) return;
        const sub: ScheduleSubtask = {
            id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            text,
            done: false,
        };
        onUpdate(item.id, { subtasks: [...subtasks, sub] });
        setNewSubtask("");
    };

    const assignTo = (memberId: string | null) => {
        onUpdate(item.id, { assigneeId: memberId });
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "group bg-card rounded-md border shadow-sm hover:border-primary/50 transition-colors relative",
                isDragging && "opacity-50 ring-2 ring-primary",
                selected && "border-primary ring-1 ring-primary"
            )}
        >
            <div className="flex items-center gap-2 p-3">
                {onToggleSelect && (
                    <Checkbox
                        checked={selected}
                        onCheckedChange={() => onToggleSelect(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                            "h-4 w-4 shrink-0 transition-opacity",
                            selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        )}
                    />
                )}
                <button
                    {...listeners}
                    {...attributes}
                    className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground touch-none"
                >
                    <GripVertical className="h-4 w-4" />
                </button>

                <button
                    onClick={() => setExpanded((e) => !e)}
                    className="flex flex-1 items-center gap-2 text-left min-w-0"
                >
                    <ChevronRight
                        className={cn(
                            "h-4 w-4 text-muted-foreground shrink-0 transition-transform",
                            expanded && "rotate-90"
                        )}
                    />
                    <span className="text-sm font-medium line-clamp-2">{item.title}</span>
                </button>

                {item.date && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0 bg-muted/60 rounded px-1.5 py-0.5">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(item.date, language)}
                    </span>
                )}

                {subtasks.length > 0 && (
                    <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                        {doneCount}/{subtasks.length}
                    </span>
                )}

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button className="shrink-0">
                            <Avatar className="h-6 w-6">
                                <AvatarImage src={item.assignee?.avatarUrl} />
                                <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                                    {item.assignee ? memberInitial(item.assignee.nickname || item.assignee.name) : "?"}
                                </AvatarFallback>
                            </Avatar>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>{t("schedule.assign_to")}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => assignTo(null)}>
                            <span className="flex items-center gap-2">
                                {t("common.unassigned")}
                                {!item.assigneeId && <Check className="h-3.5 w-3.5" />}
                            </span>
                        </DropdownMenuItem>
                        {members.map((m) => (
                            <DropdownMenuItem key={m.id} onClick={() => assignTo(m.id)}>
                                <div className="flex items-center gap-2 w-full">
                                    <Avatar className="h-5 w-5">
                                        <AvatarImage src={m.avatarUrl} />
                                        <AvatarFallback className="text-[10px]">
                                            {memberInitial(m.nickname || m.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="flex-1">{m.nickname || m.name}</span>
                                    {item.assigneeId === m.id && <Check className="h-3.5 w-3.5" />}
                                </div>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>

                <button
                    onClick={() => onDelete(item.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-red-500 rounded"
                >
                    <Trash className="h-3.5 w-3.5" />
                </button>
            </div>

            {expanded && (
                <div className="px-3 pb-3 pl-9 space-y-2 border-t border-border/50 pt-2">
                    <input
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        onBlur={saveTitle}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                saveTitle();
                                (e.target as HTMLInputElement).blur();
                            }
                            if (e.key === "Escape") setTitleDraft(item.title);
                        }}
                        title={t("common.title")}
                        aria-label={t("common.title")}
                        className="w-full h-8 rounded-md border border-input bg-transparent px-2 text-sm font-medium outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    />

                    <div className="flex items-center gap-2">
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground w-10 shrink-0">{t("schedule.date_label")}</span>
                        <input
                            type="date"
                            value={item.date || ""}
                            title={t("schedule.date_label")}
                            aria-label={t("schedule.date_label")}
                            onChange={(e) => onUpdate(item.id, { date: e.target.value || null })}
                            className="h-7 flex-1 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] scheme-dark"
                        />
                        {item.date && (
                            <button
                                type="button"
                                onClick={() => onUpdate(item.id, { date: null })}
                                className="text-xs text-muted-foreground hover:text-red-500 shrink-0"
                            >
                                {t("schedule.clear_date")}
                            </button>
                        )}
                    </div>

                    <DndContext
                        sensors={subtaskSensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleSubtaskDragEnd}
                    >
                        <SortableContext items={subtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                            {subtasks.map((s) => (
                                <SubtaskRow
                                    key={s.id}
                                    sub={s}
                                    onToggle={toggleSubtask}
                                    onRemove={removeSubtask}
                                    onEditText={updateSubtaskText}
                                    removeLabel={t("common.delete")}
                                    placeholder={t("schedule.subtask_placeholder")}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                    <div className="flex items-center gap-2">
                        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            value={newSubtask}
                            onChange={(e) => setNewSubtask(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") addSubtask();
                            }}
                            onBlur={addSubtask}
                            placeholder={t("schedule.subtask_placeholder")}
                            className="h-7 text-sm border-dashed"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
