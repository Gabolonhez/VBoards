import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Task, Project, Version, TeamMember, TaskStatus, TaskPriority } from "@/types";
import { createTask, updateTask, getProjects, getVersions, getMembers } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/language-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface TaskModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    task?: Task | null;
    onSuccess: () => void;
}

export function TaskModal({ open, onOpenChange, task, onSuccess }: TaskModalProps) {
    const { toast } = useToast();
    const { t } = useLanguage();
    const [submitting, setSubmitting] = useState(false);
    const [projects, setProjects] = useState<Project[]>([]);
    const [versions, setVersions] = useState<Version[]>([]);
    const [members, setMembers] = useState<TeamMember[]>([]);

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        status: "ideas" as TaskStatus,
        priority: "medium" as TaskPriority,
        projectId: "",
        versionId: "",
        assigneeId: "none",
        imageUrls: ""
    });

    useEffect(() => {
        if (open) {
            Promise.all([getProjects(), getVersions(), getMembers()]).then(([p, v, m]) => {
                setProjects(p);
                setVersions(v);
                setMembers(m);
            });
            if (task) {
                setFormData({
                    title: task.title,
                    description: task.description || "",
                    status: task.status,
                    priority: task.priority,
                    projectId: task.projectId,
                    versionId: task.versionId || "",
                    assigneeId: task.assigneeId || "none",
                    imageUrls: task.images?.join('\n') || ""
                });
            } else {
                setFormData({
                    title: "",
                    description: "",
                    status: "ideas",
                    priority: "medium",
                    projectId: projects[0]?.id || "",
                    versionId: "",
                    assigneeId: "none",
                    imageUrls: ""
                });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, task]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        try {
            const data = {
                ...formData,
                assigneeId: formData.assigneeId === "none" ? undefined : formData.assigneeId,
                versionId: formData.versionId === "" ? undefined : formData.versionId,
                images: formData.imageUrls.split('\n').filter(url => url.trim().length > 0)
            };
            
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { imageUrls, ...taskData } = data;

            if (task) {
                await updateTask(task.id, taskData);
            } else {
                await createTask(taskData);
            }
            toast({ title: t('common.success'), description: "Task saved" });
            onSuccess();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
            toast({ title: t('common.error'), description: "Failed to save task", variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{task ? t('board.edit_task') : t('board.create_task')}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>{t('common.title')}</Label>
                        <Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                        <Label>Description</Label>
                        <textarea
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Images (URLs, one per line)</Label>
                        <textarea
                            className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={formData.imageUrls}
                            onChange={e => setFormData({ ...formData, imageUrls: e.target.value })}
                            placeholder="https://..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t('common.project')}</Label>
                            <Select value={formData.projectId} onValueChange={v => setFormData({ ...formData, projectId: v })}>
                                <SelectTrigger><SelectValue placeholder={t('common.select_project')} /></SelectTrigger>
                                <SelectContent>
                                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>{t('roadmap.title')}</Label>
                            <Select value={formData.versionId} onValueChange={v => setFormData({ ...formData, versionId: v })}>
                                <SelectTrigger><SelectValue placeholder={t('common.none')} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">{t('common.none')}</SelectItem>
                                    {versions.filter(v => !formData.projectId || v.projectId === formData.projectId).map(v => (
                                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t('common.status')}</Label>
                            <Select value={formData.status} onValueChange={(v: TaskStatus) => setFormData({ ...formData, status: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ideas">{t('board.ideas')}</SelectItem>
                                    <SelectItem value="backlog">{t('board.backlog')}</SelectItem>
                                    <SelectItem value="in_progress">{t('board.in_progress')}</SelectItem>
                                    <SelectItem value="code_review">{t('board.code_review')}</SelectItem>
                                    <SelectItem value="done">{t('board.done')}</SelectItem>
                                    <SelectItem value="deployed">{t('board.deployed')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>{t('common.priority')}</Label>
                            <Select value={formData.priority} onValueChange={(v: TaskPriority) => setFormData({ ...formData, priority: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">{t('board.low')}</SelectItem>
                                    <SelectItem value="medium">{t('board.medium')}</SelectItem>
                                    <SelectItem value="high">{t('board.high')}</SelectItem>
                                    <SelectItem value="critical">{t('board.critical')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>{t('common.assignee')}</Label>
                        <Select value={formData.assigneeId} onValueChange={v => setFormData({ ...formData, assigneeId: v })}>
                            <SelectTrigger><SelectValue placeholder={t('common.unassigned')} /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">{t('common.unassigned')}</SelectItem>
                                {members.map(m => (
                                    <SelectItem key={m.id} value={m.id}>
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-5 w-5">
                                                <AvatarImage src={m.avatarUrl} />
                                                <AvatarFallback className="text-[10px]">{m.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <span>{m.nickname || m.name}</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={submitting}>
                            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t('common.save')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
