
"use client";

import { useEffect, useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { KanbanColumn } from "@/components/kanban/column";
import { TaskModal } from "@/components/kanban/task-modal";
import { Task, Project, Version, TaskStatus } from "@/types";
import { getTasks, getProjects, getVersions, updateTaskStatus, deleteTask } from "@/lib/api";
import { useProject } from "@/context/project-context";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/language-context";
import { Plus, Loader2, Settings2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/modals/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";



export default function BoardPage() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [versions, setVersions] = useState<Version[]>([]);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const { t } = useLanguage();
    const { toast } = useToast();

    const [searchQuery, setSearchQuery] = useState("");
    const [priorityFilter, setPriorityFilter] = useState<string>("all");
    const [versionFilter, setVersionFilter] = useState<string>("all");

    const [visibleColumns, setVisibleColumns] = useState<TaskStatus[]>([
        "ideas", "backlog", "in_progress", "code_review", "done", "deployed"
    ]);

    useEffect(() => {
        const saved = localStorage.getItem("flowos_board_columns");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setVisibleColumns(parsed);
                }
            } catch (e) {
                console.error(e);
            }
        }
    }, []);

    const toggleColumn = (colId: TaskStatus) => {
        setVisibleColumns(prev => {
            const next = prev.includes(colId)
                ? prev.filter(id => id !== colId)
                : [...prev, colId];
            localStorage.setItem("flowos_board_columns", JSON.stringify(next));
            return next;
        });
    };

    const COLUMNS: { id: TaskStatus; title: string }[] = [
        { id: "ideas", title: t('board.ideas') },
        { id: "backlog", title: t('board.backlog') },
        { id: "in_progress", title: t('board.in_progress') },
        { id: "code_review", title: t('board.code_review') },
        { id: "done", title: t('board.done') },
        { id: "deployed", title: t('board.deployed') },
    ];

    const sensors = useSensors(useSensor(PointerSensor, {
        activationConstraint: { distance: 8 }
    }));

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        try {
            const [t, p, v] = await Promise.all([getTasks(), getProjects(), getVersions()]);
            setTasks(t);
            setProjects(p);
            setVersions(v);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    function handleDeleteTask(taskId: string) {
        setDeleteTaskId(taskId);
    }

    function handleToggleSelect(taskId: string) {
        if (selectedTaskIds.includes(taskId)) {
            setSelectedTaskIds(selectedTaskIds.filter(id => id !== taskId));
        } else {
            setSelectedTaskIds([...selectedTaskIds, taskId]);
        }
    }

    async function handleBulkStatusChange(status: TaskStatus) {
        setTasks(prev => prev.map(t =>
            selectedTaskIds.includes(t.id) ? { ...t, status } : t
        ));

        const idsToUpdate = [...selectedTaskIds];
        setSelectedTaskIds([]);

        try {
            await Promise.all(idsToUpdate.map(id => updateTaskStatus(id, status)));
            toast({ title: t('common.success'), description: "Tasks updated" });
        } catch (e) {
            console.error(e);
            fetchData();
            toast({ title: "Error", description: "Failed to update tasks", variant: "destructive" });
        }
    }

    async function confirmDelete() {
        if (!deleteTaskId) return;
        try {
            await deleteTask(deleteTaskId);
            setTasks(tasks.filter(t => t.id !== deleteTaskId));
            toast({ title: t('common.success'), description: "Task deleted successfully" });
        } catch (e) {
            console.error(e);
            toast({ title: t('common.error'), description: "Failed to delete task", variant: "destructive" });
        } finally {
            setDeleteTaskId(null);
        }
    }

    function handleDragStart(event: DragStartEvent) {
        setActiveId(event.active.id as string);
    }

    async function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const taskId = active.id as string;
        const newStatus = over.id as TaskStatus;

        // Check if we are dragging a selected task
        const isDraggingSelected = selectedTaskIds.includes(taskId);
        const tasksToMove = isDraggingSelected ? selectedTaskIds : [taskId];

        // Find tasks that actually need updating (exclude ones already in the column)
        const relevantTaskIds = tasksToMove.filter(id => {
            const task = tasks.find(t => t.id === id);
            return task && task.status !== newStatus;
        });

        if (relevantTaskIds.length === 0) return;

        // Optimistic Update
        setTasks(prev => prev.map(t =>
            relevantTaskIds.includes(t.id) ? { ...t, status: newStatus } : t
        ));

        // Clear selection after move if it was a multi-select move? 
        // Usually good UX to clear selection after a drop operation to verify it happened
        if (isDraggingSelected) {
            setSelectedTaskIds([]);
        }

        try {
            await Promise.all(relevantTaskIds.map(id => updateTaskStatus(id, newStatus)));
        } catch (e) {
            console.error("Failed to update status", e);
            fetchData(); // Revert on error
        }
    }

    function handleTaskClick(task: Task) {
        setSelectedTask(task);
        setIsModalOpen(true);
    }

    function handleNewTask() {
        setSelectedTask(null);
        setIsModalOpen(true);
    }

    const { selectedProjectId } = useProject();

    const filteredTasks = tasks.filter(t => {
        const matchesProject = selectedProjectId ? t.projectId === selectedProjectId : true;
        const matchesSearch = searchQuery ? t.title.toLowerCase().includes(searchQuery.toLowerCase()) || (t.code && t.code.toLowerCase().includes(searchQuery.toLowerCase())) : true;
        const matchesPriority = priorityFilter !== "all" ? t.priority === priorityFilter : true;
        const matchesVersion = versionFilter !== "all" ? t.versionId === versionFilter : true;
        return matchesProject && matchesSearch && matchesPriority && matchesVersion;
    });

    const filteredVersions = selectedProjectId 
        ? versions.filter(v => v.projectId === selectedProjectId) 
        : versions;

    // Filter columns if needed? No, just tasks.

    if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="flex flex-col h-full overflow-hidden bg-background">
            <header className="flex flex-col gap-4 py-4 px-6 border-b shrink-0 bg-card/50">
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-semibold">{t('board.title')}</h1>
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2">
                                    <Settings2 className="h-4 w-4" />
                                    <span className="hidden sm:inline">{t('board.view')}</span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>{t('board.toggle_columns')}</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {COLUMNS.map((col) => (
                                    <DropdownMenuCheckboxItem
                                        key={col.id}
                                        checked={visibleColumns.includes(col.id)}
                                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                        onCheckedChange={(_checked) => toggleColumn(col.id)}
                                    >
                                        {col.title}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button onClick={handleNewTask} size="sm" className="gap-2">
                            <Plus className="h-4 w-4" /> {t('common.new_task')}
                        </Button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Input
                        placeholder={t('board.filter_tasks')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="max-w-[300px] h-8"
                    />
                    <div className="flex items-center gap-2">
                         <span className="text-sm font-medium whitespace-nowrap hidden sm:inline">{t('common.priority')}:</span>
                        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                            <SelectTrigger className="w-[180px] h-8">
                                <SelectValue placeholder={t('common.priority')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('common.all_projects') === "All Projects" ? "All Priorities" : "Todas Prioridades"}</SelectItem>
                                <SelectItem value="low">{t('board.low')}</SelectItem>
                                <SelectItem value="medium">{t('board.medium')}</SelectItem>
                                <SelectItem value="high">{t('board.high')}</SelectItem>
                                <SelectItem value="critical">{t('board.critical')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium whitespace-nowrap hidden sm:inline">{t('common.version')}:</span>
                        <Select value={versionFilter} onValueChange={setVersionFilter}>
                            <SelectTrigger className="w-[180px] h-8">
                                <SelectValue placeholder={t('common.all_versions')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{t('common.all_versions')}</SelectItem>
                                {filteredVersions.map(v => (
                                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </header>

            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="flex-1 overflow-x-auto overflow-y-hidden">
                    <div className="flex h-full p-6 gap-6 min-w-max">
                        {COLUMNS.filter(col => visibleColumns.includes(col.id)).map(col => (
                            <KanbanColumn
                                key={col.id}
                                id={col.id}
                                title={col.title}
                                tasks={filteredTasks.filter(t => t.status === col.id)}
                                projects={projects}
                                onTaskClick={handleTaskClick}
                                onDelete={handleDeleteTask}
                                selectedTaskIds={selectedTaskIds}
                                onToggleSelect={handleToggleSelect}
                            />
                        ))}
                    </div>
                </div>
            </DndContext>

            {selectedTaskIds.length > 0 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-popover border shadow-lg rounded-full px-6 py-2 flex items-center gap-4 animate-in slide-in-from-bottom-5 z-20">
                    <span className="text-sm font-medium">{selectedTaskIds.length} selected</span>
                    <div className="h-4 w-px bg-border" />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">Move to...</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {COLUMNS.map(col => (
                                <DropdownMenuItem key={col.id} onClick={() => handleBulkStatusChange(col.id)}>
                                    {col.title}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="ghost" size="icon" className="h-8 w-8 ml-2" onClick={() => setSelectedTaskIds([])}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )}

            <TaskModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                task={selectedTask}
                onSuccess={fetchData}
            />

            <ConfirmDialog
                isOpen={!!deleteTaskId}
                onClose={() => setDeleteTaskId(null)}
                onConfirm={confirmDelete}
                title={t('common.delete_title')}
                description={t('common.delete_desc')}
                confirmText={t('common.delete')}
                cancelText={t('common.cancel')}
                variant="destructive"
            />
        </div>
    );
}
