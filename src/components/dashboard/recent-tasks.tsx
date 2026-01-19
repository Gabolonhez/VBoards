import { Task, TaskStatus, TaskPriority } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage } from "@/context/language-context";

interface RecentTasksProps {
    tasks: Task[];
}

const STATUS_COLORS: Record<TaskStatus, string> = {
    ideas: "#94a3b8",
    backlog: "#64748b",
    in_progress: "#3b82f6",
    code_review: "#8b5cf6",
    done: "#22c55e",
    deployed: "#10b981",
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
    low: "#94a3b8",
    medium: "#eab308",
    high: "#f97316",
    critical: "#ef4444",
};

export function RecentTasks({ tasks }: RecentTasksProps) {
    const { t } = useLanguage();
    return (
        <div className="bg-card rounded-xl border border-border p-5">
            <h2 className="text-lg font-semibold text-foreground mb-4">{t('dashboard.recent_activity')}</h2>
            <div className="space-y-3">
                {tasks.map((task) => {
                    // Version lookup removed since we moved to backend and don't load all versions here
                    // const version = task.versionId ? getVersionById(task.versionId) : null;
                    const version = null; 
                    return (
                        <div
                            key={task.id}
                            className="flex items-start gap-3 p-3 rounded-lg bg-background/50 hover:bg-background transition-colors cursor-pointer group"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-mono text-muted-foreground">
                                        {task.code}
                                    </span>
                                    <Badge
                                        variant="outline"
                                        className="text-xs capitalize"
                                        style={{
                                            borderColor: STATUS_COLORS[task.status],
                                            color: STATUS_COLORS[task.status],
                                            backgroundColor: `${STATUS_COLORS[task.status]}15`,
                                        }}
                                    >
                                        {t(`board.${task.status}` as any)}
                                    </Badge>
                                </div>
                                <p className="text-sm font-medium text-foreground mb-2 truncate group-hover:text-primary transition-colors">
                                    {task.title}
                                </p>
                                <div className="flex items-center gap-2">
                                    {/* {version && (
                                        <Badge
                                            variant="secondary"
                                            className="text-xs bg-primary/10 text-primary border-0"
                                        >
                                            {version.name}
                                        </Badge>
                                    )} */}
                                    <Badge
                                        variant="outline"
                                        className="text-xs capitalize"
                                        style={{
                                            borderColor: PRIORITY_COLORS[task.priority],
                                            color: PRIORITY_COLORS[task.priority],
                                        }}
                                    >
                                        {t(`board.${task.priority}` as any)}
                                    </Badge>
                                </div>
                            </div>
                            {task.assignee && (
                                <Avatar className="h-8 w-8 ring-2 ring-background">
                                    <AvatarImage src={task.assignee.avatarUrl} />
                                    <AvatarFallback>
                                        {task.assignee.name?.charAt(0) || '?'}
                                    </AvatarFallback>
                                </Avatar>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
