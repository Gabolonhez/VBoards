"use client";

import { useEffect, useState } from "react";
import { getVersions, getProjects, createVersion, updateVersion, deleteVersion, getMembers } from "@/lib/api";
import { Version, Project, VersionStatus, TeamMember } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, MoreHorizontal, Trash, Edit, LayoutList, LayoutGrid } from "lucide-react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { RoadmapBoard } from "@/components/roadmap/roadmap-board";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/modals/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useProject } from "@/context/project-context";
import { useLanguage } from "@/context/language-context";
import { useAuth } from "@/context/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function RoadmapPage() {
    const { organization } = useAuth();
    const [versions, setVersions] = useState<Version[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'list' | 'board'>('list');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
    const { toast } = useToast();
    const { t } = useLanguage();

    // Load saved view mode preference
    useEffect(() => {
        const savedView = localStorage.getItem('flowos_roadmap_view');
        if (savedView === 'list' || savedView === 'board') {
            setViewMode(savedView);
        }
    }, []);

    const toggleView = (mode: 'list' | 'board') => {
        setViewMode(mode);
        localStorage.setItem('flowos_roadmap_view', mode);
    };

    const [formData, setFormData] = useState({
        name: "",
        projectId: "",
        status: "in_development" as VersionStatus,
        releaseDate: "",
        notes: "",
        ownerId: "none"
    });
    const [deleteVersionId, setDeleteVersionId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

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
            const [vData, pData, mData] = await Promise.all([
                getVersions(organization.id),
                getProjects(organization.id),
                getMembers(organization.id)
            ]);
            setVersions(vData);
            setProjects(pData);
            setMembers(mData);
        } catch (error) {
            console.error(error);
            toast({ title: t('common.error'), description: t('roadmap.load_error'), variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formData.projectId || !formData.name || !organization) return;

        setSubmitting(true);
        try {
            const data = {
                ...formData,
                ownerId: formData.ownerId === "none" ? undefined : formData.ownerId
            };

            if (editingVersionId) {
                await updateVersion(editingVersionId, data);
                toast({ title: t('common.success'), description: t('roadmap.version_updated') });
            } else {
                await createVersion(data, organization.id);
                toast({ title: t('common.success'), description: t('roadmap.version_created') });
            }
            setIsDialogOpen(false);
            setEditingVersionId(null);
            fetchData();
            setFormData({ name: "", projectId: "", status: "in_development", releaseDate: "", notes: "", ownerId: "none" });
        } catch (error) {
            console.error(error)
            toast({ title: t('common.error'), description: editingVersionId ? t('roadmap.update_error') : t('roadmap.create_error'), variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    }

    function handleEdit(version: Version) {
        setEditingVersionId(version.id);
        setFormData({
            name: version.name,
            projectId: version.projectId,
            status: version.status,
            releaseDate: version.releaseDate ? version.releaseDate.split('T')[0] : "",
            notes: version.notes || "",
            ownerId: version.ownerId || "none"
        });
        setIsDialogOpen(true);
    }

    async function handleDelete(id: string) {
        setDeleteVersionId(id);
    }

    async function confirmDelete() {
        if (!deleteVersionId) return;
        try {
            await deleteVersion(deleteVersionId);
            toast({ title: t('common.success'), description: t('roadmap.version_deleted') });
            fetchData();
        } catch {
            toast({ title: t('common.error'), description: t('roadmap.delete_error'), variant: "destructive" });
        } finally {
            setDeleteVersionId(null);
        }
    }

    const getStatusLabel = (status: VersionStatus) => {
        switch (status) {
            case "planned": return t('roadmap.planned');
            case "in_development": return t('roadmap.in_development');
            case "in_stores": return t('roadmap.in_stores');
            case "deprecated": return t('roadmap.deprecated');
            default: return status;
        }
    };

    const { selectedProjectId } = useProject();

    // Filter versions based on selected project
    const filteredVersions = versions.filter(v =>
        selectedProjectId ? v.projectId === selectedProjectId : true
    );

    // Initial project selection for new version dialog
    useEffect(() => {
        if (selectedProjectId) {
            setFormData(prev => ({ ...prev, projectId: selectedProjectId }));
        }
    }, [selectedProjectId]);

    async function handleStatusChange(id: string, newStatus: VersionStatus) {
        // Optimistic update
        setVersions(prev => prev.map(v => v.id === id ? { ...v, status: newStatus } : v));

        try {
            await updateVersion(id, { status: newStatus });
            toast({ title: t('common.success'), description: t('roadmap.version_updated') });
        } catch (error) {
            console.error(error);
            toast({ title: t('common.error'), description: t('roadmap.update_error'), variant: "destructive" });
            fetchData(); // Revert
        }
    }

    if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

    return (
        <div className="flex flex-col h-full bg-background text-foreground animate-in fade-in duration-500">
            <header className="flex items-center justify-between h-16 px-6 border-b border-border bg-card/50 backdrop-blur">
                <div>
                    <h1 className="text-xl font-semibold">{t('roadmap.title')}</h1>
                    <p className="text-sm text-muted-foreground">{t('roadmap.subtitle')}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2" onClick={() => {
                                setEditingVersionId(null);
                                setFormData({ name: "", projectId: selectedProjectId || projects[0]?.id || "", status: "in_development", releaseDate: "", notes: "", ownerId: "none" });
                            }}>
                                <Plus className="h-4 w-4" /> {t('common.new_version')}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>{editingVersionId ? t('roadmap.edit_version') : t('roadmap.create_version')}</DialogTitle>
                                <DialogDescription>{editingVersionId ? t('roadmap.edit_desc') : t('roadmap.create_desc')}</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="project">{t('common.project')}</Label>
                                    <Select
                                        value={formData.projectId}
                                        onValueChange={(val) => setFormData({ ...formData, projectId: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={t('common.select_project')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {projects.map(p => (
                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="name">{t('roadmap.version_name')}</Label>
                                    <Input id="name" placeholder="v1.0.0" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">{t('roadmap.description_optional')}</Label>
                                    <Input
                                        id="description"
                                        value={formData.notes}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="status">{t('common.status')}</Label>
                                    <Select
                                        value={formData.status}
                                        onValueChange={(val: VersionStatus) => setFormData({ ...formData, status: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="planned">{t('roadmap.planned')}</SelectItem>
                                            <SelectItem value="in_development">{t('roadmap.in_development')}</SelectItem>
                                            <SelectItem value="in_stores">{t('roadmap.in_stores')}</SelectItem>
                                            <SelectItem value="deprecated">{t('roadmap.deprecated')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('common.owner')}</Label>
                                    <Select value={formData.ownerId} onValueChange={v => setFormData({ ...formData, ownerId: v })}>
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
                                <div className="space-y-2">
                                    <Label htmlFor="date">{t('roadmap.release_date_optional')}</Label>
                                    <Input id="date" type="date" value={formData.releaseDate} onChange={e => setFormData({ ...formData, releaseDate: e.target.value })} />
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={submitting}>
                                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingVersionId ? t('common.save') : t('common.create')}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                    <div className="flex items-center bg-muted rounded-lg p-1">
                        <Button
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-8 px-3"
                            onClick={() => toggleView('list')}
                        >
                            <LayoutList className="h-4 w-4 mr-2" />
                            {t('roadmap.view_list')}
                        </Button>
                        <Button
                            variant={viewMode === 'board' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-8 px-3"
                            onClick={() => toggleView('board')}
                        >
                            <LayoutGrid className="h-4 w-4 mr-2" />
                            {t('roadmap.view_board')}
                        </Button>
                    </div>
                </div>
            </header>

            <div className="flex-1 p-6 overflow-hidden">
                {viewMode === 'list' ? (
                    <div className="rounded-md border bg-card overflow-auto h-full">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('roadmap.version_name')}</TableHead>
                                    <TableHead>{t('common.project')}</TableHead>
                                    <TableHead>{t('common.owner')}</TableHead>
                                    <TableHead>{t('common.status')}</TableHead>
                                    <TableHead>{t('roadmap.release_date')}</TableHead>
                                    <TableHead className="text-right">{t('common.actions')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredVersions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                            {t('roadmap.no_versions')}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredVersions.map((version) => (
                                        <TableRow key={version.id}>
                                            <TableCell className="font-medium">{version.name}</TableCell>
                                            <TableCell>
                                                {(() => {
                                                    const project = projects.find(p => p.id === version.projectId);
                                                    return project ? (
                                                        <Badge variant="outline" style={{ borderColor: project.color, color: project.color }}>
                                                            {project.name}
                                                        </Badge>
                                                    ) : <span className="text-muted-foreground">-</span>;
                                                })()}
                                            </TableCell>
                                            <TableCell>
                                                {version.owner ? (
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-6 w-6">
                                                            <AvatarImage src={version.owner.avatarUrl} />
                                                            <AvatarFallback className="text-[10px]">{version.owner.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                        </Avatar>
                                                        <span className="text-sm">{version.owner.nickname || version.owner.name}</span>
                                                    </div>
                                                ) : <span className="text-muted-foreground text-sm">-</span>}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={
                                                    version.status === 'in_stores' ? 'default' :
                                                        version.status === 'deprecated' ? 'destructive' : 'secondary'
                                                }>
                                                    {getStatusLabel(version.status)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {version.releaseDate ? new Date(version.releaseDate).toLocaleDateString() : "-"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleEdit(version)}>
                                                            <Edit className="mr-2 h-4 w-4" /> {t('common.edit')}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(version.id)}>
                                                            <Trash className="mr-2 h-4 w-4" /> {t('common.delete')}
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <RoadmapBoard
                        versions={filteredVersions}
                        projects={projects}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onStatusChange={handleStatusChange}
                    />
                )}
            </div>

            <ConfirmDialog
                isOpen={!!deleteVersionId}
                onClose={() => setDeleteVersionId(null)}
                onConfirm={confirmDelete}
                title={t('common.delete_title')}
                description={t('common.delete_desc')}
                confirmText={t('common.delete')}
                cancelText={t('common.cancel')}
                variant="destructive"
            />
        </div >
    );
}
