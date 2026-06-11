"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
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

// Today's date (YYYY-MM-DD) in Brazil timezone — 'en-CA' yields ISO-like format
function todayInBrazil(): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
}

function toISO(dt: Date): string {
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${dt.getFullYear()}-${mm}-${dd}`;
}

function shiftDate(date: string, deltaDays: number): string {
    const [y, m, d] = date.split("-").map(Number);
    return toISO(new Date(y, m - 1, d + deltaDays));
}

function shiftMonth(date: string, delta: number): string {
    const [y, m, d] = date.split("-").map(Number);
    const target = new Date(y, m - 1 + delta, 1);
    const daysInMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(d, daysInMonth));
    return toISO(target);
}

// Monday–Sunday range containing the given date
function weekRange(date: string): { start: string; end: string } {
    const [y, m, d] = date.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    const diffToMonday = (dt.getDay() + 6) % 7; // 0=Mon ... 6=Sun
    const start = new Date(y, m - 1, d - diffToMonday);
    const end = new Date(y, m - 1, d - diffToMonday + 6);
    return { start: toISO(start), end: toISO(end) };
}

function localeOf(language: string): string {
    return language === "pt" ? "pt-BR" : language === "es" ? "es-ES" : "en-US";
}

function fmtDayMonth(date: string, language: string): string {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(localeOf(language), { day: "2-digit", month: "short" });
}

function fmtMonthYear(date: string, language: string): string {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(localeOf(language), { month: "long", year: "numeric" });
}

// Does the item's date fall within the period defined by scope + anchor date?
function matchesDate(itemDate: string | null | undefined, scope: ScheduleScope, anchor: string): boolean {
    if (!itemDate) return false;
    if (scope === "day") return itemDate === anchor;
    if (scope === "month") return itemDate.slice(0, 7) === anchor.slice(0, 7);
    const { start, end } = weekRange(anchor);
    return itemDate >= start && itemDate <= end;
}

export default function SchedulePage() {
    const { organization } = useAuth();
    const { t, language } = useLanguage();
    const { toast } = useToast();

    const [items, setItems] = useState<ScheduleItem[]>([]);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);

    const [scope, setScope] = useState<ScheduleScope>("month");
    const [assigneeFilter, setAssigneeFilter] = useState<string>("all"); // 'all' | memberId
    const [selectedDate, setSelectedDate] = useState<string>(() => todayInBrazil());
    const [dateFilterActive, setDateFilterActive] = useState(true);

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

    const visibleItems = items.filter((i) => {
        if (i.scope !== scope) return false;
        if (assigneeFilter !== "all" && i.assigneeId !== assigneeFilter) return false;
        if (dateFilterActive && !matchesDate(i.date, scope, selectedDate)) return false;
        return true;
    });

    async function handleCreate(status: ScheduleStatus, title: string) {
        if (!organization) return;
        const assigneeId = assigneeFilter !== "all" ? assigneeFilter : null;
        const position = items.filter((i) => i.scope === scope && i.status === status).length;
        try {
            const created = await createScheduleItem(
                { scope, status, title, assigneeId, subtasks: [], position, date: selectedDate },
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

                {/* Scope tabs + date filter */}
                <div className="flex items-end justify-between mt-4 gap-4 flex-wrap">
                    <div className="flex items-center gap-6">
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

                    <div className="flex items-center gap-1.5 pb-1">
                        <button
                            type="button"
                            aria-label="Previous"
                            onClick={() =>
                                setSelectedDate((d) =>
                                    scope === "month" ? shiftMonth(d, -1) : shiftDate(d, scope === "week" ? -7 : -1)
                                )
                            }
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>

                        {scope === "day" ? (
                            <div className="relative flex items-center">
                                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground absolute left-2 pointer-events-none" />
                                <input
                                    type="date"
                                    value={selectedDate}
                                    title={t("schedule.date_label")}
                                    aria-label={t("schedule.date_label")}
                                    onChange={(e) => {
                                        if (e.target.value) setSelectedDate(e.target.value);
                                    }}
                                    className="h-8 rounded-md border border-input bg-transparent pl-7 pr-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] scheme-dark"
                                />
                            </div>
                        ) : (
                            <span className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-input text-sm capitalize min-w-[150px] justify-center">
                                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                                {scope === "month"
                                    ? fmtMonthYear(selectedDate, language)
                                    : `${fmtDayMonth(weekRange(selectedDate).start, language)} – ${fmtDayMonth(weekRange(selectedDate).end, language)}`}
                            </span>
                        )}

                        <button
                            type="button"
                            aria-label="Next"
                            onClick={() =>
                                setSelectedDate((d) =>
                                    scope === "month" ? shiftMonth(d, 1) : shiftDate(d, scope === "week" ? 7 : 1)
                                )
                            }
                            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedDate(todayInBrazil())}
                            className="ml-1 px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                            {t("schedule.today")}
                        </button>
                        <button
                            type="button"
                            onClick={() => setDateFilterActive((a) => !a)}
                            className={cn(
                                "px-2 py-1 rounded-full text-xs font-medium transition-colors",
                                !dateFilterActive
                                    ? "bg-primary/20 text-primary"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                        >
                            {t("schedule.all_dates")}
                        </button>
                    </div>
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
