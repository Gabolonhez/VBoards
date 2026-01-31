import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Task, Project, Version, TeamMember, TaskStatus, TaskPriority } from "@/types";
import { createTask, updateTask, getProjects, getVersions, getMembers } from "@/lib/api";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Loader2 } from "lucide-react";
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
    const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
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
        imageUrls: "",
        type: null as 'us' | 'bug' | null
    });

    useEffect(() => {
        if (open) {
            Promise.all([getProjects(), getVersions(), getMembers()]).then(([p, v, m]) => {
                setProjects(p);
                setVersions(v);
                setMembers(m);

                if (task) {
                    setSelectedProjectIds([task.projectId]);
                    setFormData({
                        title: task.title,
                        description: task.description || "",
                        status: task.status,
                        priority: task.priority,
                        projectId: task.projectId,
                        versionId: task.versionId || "",
                        assigneeId: task.assigneeId || "none",
                        imageUrls: task.images?.join('\n') || "",
                        type: task.type || null
                    });
                } else {
                    const defaultProject = p.length > 0 ? [p[0].id] : [];
                    setSelectedProjectIds(defaultProject);
                    setFormData({
                        title: "",
                        description: "",
                        status: "ideas",
                        priority: "medium",
                        projectId: defaultProject[0] || "",
                        versionId: "",
                        assigneeId: "none",
                        imageUrls: "",
                        type: null
                    });
                }
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, task]);

    const toggleProject = (projectId: string) => {
        // If editing existing task, do not allow multi-select or changing project easily (complex)
        // allowing checking only if it's new task
        if (task) return;

        setSelectedProjectIds(prev => {
            const next = prev.includes(projectId)
                ? prev.filter(id => id !== projectId)
                : [...prev, projectId];

            // Update formData.projectId to the first selected one for compatibility with version filter
            if (next.length > 0) {
                setFormData(fd => ({ ...fd, projectId: next[0] }));
            }
            return next;
        });
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        if (selectedProjectIds.length === 0) {
            toast({ title: "Error", description: "Select at least one project", variant: "destructive" });
            setSubmitting(false);
            return;
        }

        try {
            const dataTemplate = {
                ...formData,
                assigneeId: formData.assigneeId === "none" ? null : formData.assigneeId,
                versionId: formData.versionId === "" || formData.versionId === "none" || selectedProjectIds.length > 1 ? null : formData.versionId, // Clear version if none/multi-project
                images: formData.imageUrls.split('\n').filter(url => url.trim().length > 0)
            };

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { imageUrls, ...taskData } = dataTemplate;

            if (task) {
                // Update single task
                await updateTask(task.id, { ...taskData, projectId: selectedProjectIds[0] });
            } else {
                // Create multiple tasks
                await Promise.all(selectedProjectIds.map(pid =>
                    createTask({ ...taskData, projectId: pid })
                ));
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
                        <Label>{t('common.type')}</Label>
                        <Select
                            value={formData.type || "none"}
                            onValueChange={(v: string) => setFormData({ ...formData, type: v === "none" ? null : v as 'us' | 'bug' })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder={t('common.none')} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">{t('common.none')}</SelectItem>
                                <SelectItem value="us">{t('common.us')}</SelectItem>
                                <SelectItem value="bug">{t('common.bug')}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
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
                            {task ? (
                                <Select
                                    value={selectedProjectIds[0]}
                                    onValueChange={(value) => {
                                        setSelectedProjectIds([value]);
                                        setFormData(prev => ({
                                            ...prev,
                                            projectId: value,
                                            versionId: "" // Reset version when project changes
                                        }));
                                    }}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {projects.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="w-full justify-between font-normal">
                                            {selectedProjectIds.length === 0 ? t('common.select_project') :
                                                selectedProjectIds.length === 1 ? projects.find(p => p.id === selectedProjectIds[0])?.name :
                                                    `${selectedProjectIds.length} projects selected`}
                                            <ChevronDown className="h-4 w-4 opacity-50" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-[200px]">
                                        {projects.map(p => (
                                            <DropdownMenuCheckboxItem
                                                key={p.id}
                                                checked={selectedProjectIds.includes(p.id)}
                                                onCheckedChange={() => toggleProject(p.id)}
                                            >
                                                {p.name}
                                            </DropdownMenuCheckboxItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>{t('roadmap.title')}</Label>
                            <Select
                                value={formData.versionId}
                                onValueChange={v => setFormData({ ...formData, versionId: v })}
                                disabled={selectedProjectIds.length > 1}
                            >
                                <SelectTrigger><SelectValue placeholder={t('common.none')} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">{t('common.none')}</SelectItem>
                                    {versions.filter(v => selectedProjectIds.length === 1 && v.projectId === selectedProjectIds[0]).map(v => (
                                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedProjectIds.length > 1 && <p className="text-[10px] text-muted-foreground">Version disabled for multiple projects</p>}
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
