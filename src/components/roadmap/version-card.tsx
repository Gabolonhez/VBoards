"use client";

import { useDraggable } from "@dnd-kit/core";
import { Version, Project } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Edit, Trash, Calendar } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";

interface VersionCardProps {
    version: Version;
    project?: Project;
    onEdit: (version: Version) => void;
    onDelete: (id: string) => void;
}

export function VersionCard({ version, project, onEdit, onDelete }: VersionCardProps) {
    const { t } = useLanguage();
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: version.id,
        data: version
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
            className={cn(
                "bg-card border rounded-md p-3 shadow-sm space-y-3 cursor-grab hover:border-primary/50 transition-colors relative group",
                isDragging && "opacity-50 z-50 ring-2 ring-primary rotate-2"
            )}
            onClick={() => !isDragging && onEdit(version)}
        >
            <div className="flex items-start justify-between">
                <div>
                    <h4 className="font-semibold text-sm">{version.name}</h4>
                    {project && (
                        <div className="mt-1">
                            <Badge
                                variant="outline"
                                className="text-[10px] px-1 py-0 h-4 border-0 text-white"
                                style={{ backgroundColor: project.color }}
                            >
                                {project.name}
                            </Badge>
                        </div>
                    )}
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            // Prevent drag when clicking menu
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            <span className="sr-only">{t('common.open_menu')}</span>
                            <MoreHorizontal className="h-3 w-3" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(version)}>
                            <Edit className="mr-2 h-4 w-4" /> {t('common.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(version.id)}>
                            <Trash className="mr-2 h-4 w-4" /> {t('common.delete')}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {version.notes && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                    {version.notes}
                </p>
            )}

            <div className="flex items-center text-xs text-muted-foreground pt-2 border-t mt-2">
                <Calendar className="h-3 w-3 mr-1" />
                <span>
                    {version.releaseDate
                        ? new Date(version.releaseDate).toLocaleDateString()
                        : t('roadmap.tbd')}
                </span>
            </div>
        </div>
    );
}
