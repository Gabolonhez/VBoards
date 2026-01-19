"use client";

import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import { Project, Task } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";

import { Trash } from "lucide-react";

interface TaskCardProps {
    task: Task;
    project?: Project;
    onClick: (task: Task) => void;
    onDelete: (id: string) => void;
}

export function TaskCard({ task, project, onClick, onDelete }: TaskCardProps) {
    const { t } = useLanguage();
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: task.id,
        data: task
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            onClick={() => onClick(task)}
            className={cn(
                "group bg-card p-3 rounded-md border shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors space-y-3 relative",
                isDragging && "opacity-50 ring-2 ring-primary ring-offset-2"
            )}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-muted-foreground">{task.code}</span>
                {project && (
                    <Badge variant="outline" className="h-5 px-1 text-[10px]" style={{ color: project.color, borderColor: project.color }}>
                        {project.prefix}
                    </Badge>
                )}
            </div>

            <p className="text-sm font-medium line-clamp-2 pr-4">{task.title}</p>

            <div className="flex items-center justify-between mt-2">
                <Badge variant={task.priority === 'critical' ? 'destructive' : 'secondary'} className="text-[10px] h-5 px-1 capitalize">
                    {t(`board.${task.priority}` as any)}
                </Badge>

                {task.assignee && (
                    <Avatar className="h-6 w-6">
                        <AvatarImage src={task.assignee.avatarUrl} />
                        <AvatarFallback>{task.assignee.name?.slice(0, 2).toUpperCase() || '??'}</AvatarFallback>
                    </Avatar>
                )}
            </div>

            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete(task.id);
                }}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-red-500 rounded bg-card/80 backdrop-blur-sm"
            >
                <Trash className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}
