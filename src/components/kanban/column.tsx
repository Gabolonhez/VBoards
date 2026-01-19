
"use client";

import { useDroppable } from "@dnd-kit/core";
import { TaskStatus, Task, Project } from "@/types";
import { cn } from "@/lib/utils";
import { TaskCard } from "./task-card";

interface KanbanColumnProps {
    id: TaskStatus;
    title: string;
    tasks: Task[];
    projects: Project[];
    onTaskClick: (task: Task) => void;
    onDelete: (id: string) => void;
    selectedTaskIds?: string[];
    onToggleSelect?: (id: string) => void;
}

export function KanbanColumn({ id, title, tasks, projects, onTaskClick, onDelete, selectedTaskIds, onToggleSelect }: KanbanColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: id,
    });

    return (
        <div className="flex flex-col h-full min-w-[300px] w-[300px]">
            <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase">{title}</h3>
                <span className="bg-muted text-muted-foreground text-xs px-2 py-0.5 rounded-full">
                    {tasks.length}
                </span>
            </div>

            <div
                ref={setNodeRef}
                className={cn(
                    "flex-1 bg-muted/20 rounded-lg p-3 space-y-3 overflow-y-auto no-scrollbar",
                    isOver && "bg-primary/5 ring-1 ring-primary/20"
                )}
            >
                {tasks.map((task) => (
                    <TaskCard
                        key={task.id}
                        task={task}
                        project={projects.find(p => p.id === task.projectId)}
                        onClick={onTaskClick}
                        onDelete={onDelete}
                        selected={selectedTaskIds?.includes(task.id)}
                        onToggleSelect={onToggleSelect}
                    />
                ))}
            </div>
        </div>
    );
}
