"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
    getScheduleItems,
    createScheduleItem,
    updateScheduleItem,
    deleteScheduleItem,
    getScheduleNote,
    upsertScheduleNote,
    getMembers,
} from "@/lib/api";
import { ScheduleItem, ScheduleScope, ScheduleStatus, TeamMember } from "@/types";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { ScheduleBoard, ScheduleReorderUpdate } from "@/components/schedule/schedule-board";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const SCOPES: ScheduleScope[] = ["month", "week", "day"];

function memberInitial(name?: string) {
    return name?.trim()?.[0]?.toUpperCase() || "?";
}

export default function SchedulePage() {
    const { organization } = useAuth();
    const { t } = useLanguage();
    const { toast } = useToast();

    const [items, setItems] = useState<ScheduleItem[]>([]);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);

    const [scope, setScope] = useState<ScheduleScope>("month");
    const [assigneeFilter, setAssigneeFilter] = useState<string>("all"); // 'all' | memberId

    const [note, setNote] = useState("");
    const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Restore persisted preferences
    useEffect(() => {
        const savedScope = localStorage.getItem("vboards_schedule_scope");
        if (savedScope === "month" || savedScope === "week" || savedScope === "day") {
            setScope(savedScope);
        }
        const savedAssignee = localStorage.getItem("vboards_schedule_assignee");
        if (savedAssignee) setAssigneeFilter(savedAssignee);
    }, []);

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [organization]);

    async function fetchData() {
        if (!organization) {
            setLoading(false);
            return;
        }
        try {
            const [sData, mData] = await Promise.all([
                getScheduleItems(organization.id),
                getMembers(organization.id),
            ]);
            setItems(sData);
            setMembers(mData);
        } catch (error) {
            console.error(error);
            toast({ title: t("common.error"), description: t("schedule.load_error"), variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }

    // Load the note for the current owner key
    useEffect(() => {
        if (!organization) return;
        let cancelled = false;
        getScheduleNote(organization.id, assigneeFilter)
            .then((n) => {
                if (!cancelled) setNote(n?.content || "");
            })
            .catch((e) => console.error(e));
        return () => {
            cancelled = true;
        };
    }, [organization, assigneeFilter]);

    const changeScope = (s: ScheduleScope) => {
        setScope(s);
        localStorage.setItem("vboards_schedule_scope", s);
    };

    const changeAssignee = (id: string) => {
        setAssigneeFilter(id);
        localStorage.setItem("vboards_schedule_assignee", id);
    };

    const visibleItems = items.filter(
        (i) => i.scope === scope && (assigneeFilter === "all" || i.assigneeId === assigneeFilter)
    );

    async function handleCreate(status: ScheduleStatus, title: string) {
        if (!organization) return;
        const assigneeId = assigneeFilter !== "all" ? assigneeFilter : null;
        const position = items.filter((i) => i.scope === scope && i.status === status).length;
        try {
            const created = await createScheduleItem(
                { scope, status, title, assigneeId, subtasks: [], position },
                organization.id
            );
            setItems((prev) => [...prev, created]);
        } catch (e) {
            console.error(e);
            toast({ title: t("common.error"), description: t("schedule.save_error"), variant: "destructive" });
        }
    }

    async function handleUpdate(id: string, updates: Partial<ScheduleItem>) {
        // Optimistic update (re-resolve assignee object if reassigned)
        setItems((prev) =>
            prev.map((i) => {
                if (i.id !== id) return i;
                const next = { ...i, ...updates };
                if (updates.assigneeId !== undefined) {
                    next.assignee = members.find((m) => m.id === updates.assigneeId) || undefined;
                }
                return next;
            })
        );
        try {
            await updateScheduleItem(id, updates);
        } catch (e) {
            console.error(e);
            toast({ title: t("common.error"), description: t("schedule.save_error"), variant: "destructive" });
            fetchData();
        }
    }

    async function handleReorder(updates: ScheduleReorderUpdate[]) {
        if (updates.length === 0) return;
        // Optimistic update
        setItems((prev) =>
            prev.map((i) => {
                const u = updates.find((x) => x.id === i.id);
                return u ? { ...i, status: u.status, position: u.position } : i;
            })
        );
        try {
            await Promise.all(
                updates.map((u) => updateScheduleItem(u.id, { status: u.status, position: u.position }))
            );
        } catch (e) {
            console.error(e);
            toast({ title: t("common.error"), description: t("schedule.save_error"), variant: "destructive" });
            fetchData();
        }
    }

    async function handleDelete(id: string) {
        setItems((prev) => prev.filter((i) => i.id !== id));
        try {
            await deleteScheduleItem(id);
        } catch (e) {
            console.error(e);
            toast({ title: t("common.error"), description: t("schedule.save_error"), variant: "destructive" });
            fetchData();
        }
    }

    function handleNoteChange(value: string) {
        setNote(value);
        if (!organization) return;
        if (noteTimer.current) clearTimeout(noteTimer.current);
        const orgId = organization.id;
        const key = assigneeFilter;
        noteTimer.current = setTimeout(() => {
            upsertScheduleNote(orgId, key, value).catch((e) => console.error(e));
        }, 800);
    }

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
        );
    }

    const filterChips = [{ id: "all", label: t("schedule.all") }, ...members.map((m) => ({ id: m.id, label: m.nickname || m.name }))];

    return (
        <div className="flex flex-col h-full bg-background text-foreground animate-in fade-in duration-500">
            <header className="px-6 pt-6 pb-2 border-b border-border bg-card/30">
                <h1 className="text-2xl font-semibold tracking-tight">{t("schedule.title")}</h1>
                <p className="text-sm text-muted-foreground">{t("schedule.subtitle")}</p>

                {/* Assignee filter */}
                <div className="flex items-center gap-2 mt-4 flex-wrap">
                    {filterChips.map((chip) => (
                        <button
                            key={chip.id}
                            onClick={() => changeAssignee(chip.id)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors",
                                assigneeFilter === chip.id
                                    ? "bg-primary/20 text-primary"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                        >
                            {chip.id !== "all" && (
                                <Avatar className="h-4 w-4">
                                    <AvatarImage src={members.find((m) => m.id === chip.id)?.avatarUrl} />
                                    <AvatarFallback className="text-[8px]">{memberInitial(chip.label)}</AvatarFallback>
                                </Avatar>
                            )}
                            {chip.label}
                        </button>
                    ))}
                </div>

                {/* Scope tabs */}
                <div className="flex items-center gap-6 mt-4">
                    {SCOPES.map((s) => (
                        <button
                            key={s}
                            onClick={() => changeScope(s)}
                            className={cn(
                                "relative pb-2 text-sm font-medium transition-colors",
                                scope === s ? "text-amber-400" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {t(`schedule.${s}`)}
                            {scope === s && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400 rounded-full" />
                            )}
                        </button>
                    ))}
                </div>
            </header>

            <div className="flex-1 px-6 py-4 overflow-hidden">
                <ScheduleBoard
                    items={visibleItems}
                    members={members}
                    onCreate={handleCreate}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    onReorder={handleReorder}
                />
            </div>

            {/* Day notes */}
            {scope === "day" && (
                <div className="px-6 pb-6 pt-2 border-t border-border bg-card/30">
                    <label className="text-xs tracking-widest text-muted-foreground uppercase">
                        {t("schedule.day_notes")}
                    </label>
                    <textarea
                        value={note}
                        onChange={(e) => handleNoteChange(e.target.value)}
                        placeholder={t("schedule.notes_placeholder")}
                        className="mt-2 w-full min-h-[90px] rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] resize-none"
                    />
                </div>
            )}
        </div>
    );
}
