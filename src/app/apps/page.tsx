
"use client";

import { useState, useEffect } from "react";
import { Plus, Loader2, MoreHorizontal, Pencil, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/modals/confirm-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Project } from "@/types";
import { getProjects, createProject, updateProject, deleteProject } from "@/lib/api";
import { useLanguage } from "@/context/language-context";
import { useAuth } from "@/context/auth-context";

export default function AppsPage() {
    const { organization } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState<Partial<Project>>({ name: "", prefix: "", color: "#3b82f6" });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
    const { toast } = useToast();
    const { t } = useLanguage();

    async function fetchData() {
        if (!organization) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const data = await getProjects(organization.id);
            setProjects(data);
        } catch (error) {
            console.error("Failed to fetch projects", error);
            toast({ title: t('common.error'), description: "Failed to load projects", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchData();
    }, [organization]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!organization) return;
        setSubmitting(true);
        try {
            if (editingId) {
                await updateProject(editingId, formData);
                toast({ title: t('common.success'), description: "App updated successfully" });
            } else {
                await createProject(formData, organization.id);
                toast({ title: t('common.success'), description: "App created successfully" });
            }
            setIsDialogOpen(false);
            setFormData({ name: "", prefix: "", color: "#3b82f6" });
            setEditingId(null);
            fetchData();
        } catch (error) {
            console.error(error);
            toast({ title: t('common.error'), description: "Failed to save app", variant: "destructive" });
        } finally {
            setSubmitting(false);
        }
    };

    const handleEdit = (project: Project) => {
        setFormData({ name: project.name, prefix: project.prefix, color: project.color });
        setEditingId(project.id);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        setDeleteProjectId(id);
    };

    const confirmDelete = async () => {
        if (!deleteProjectId) return;
        try {
            await deleteProject(deleteProjectId);
            toast({ title: t('common.success'), description: "App deleted successfully" });
            fetchData();
        } catch (error) {
            console.error(error);
            toast({ title: t('common.error'), description: "Failed to delete app", variant: "destructive" });
        } finally {
            setDeleteProjectId(null);
        }
    };

    const openNewDialog = () => {
        setFormData({ name: "", prefix: "", color: "#3b82f6" });
        setEditingId(null);
        setIsDialogOpen(true);
    };

    if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

    return (
        <div className="flex flex-col h-full bg-background text-foreground animate-in fade-in duration-500">
            <header className="flex items-center justify-between h-16 px-6 border-b border-border bg-card/50 backdrop-blur shrink-0">
                <div>
                    <h1 className="text-xl font-semibold">{t('apps.title')}</h1>
                    <p className="text-sm text-muted-foreground">{t('apps.subtitle')}</p>
                </div>
                <Button className="gap-2" onClick={openNewDialog}>
                    <Plus className="h-4 w-4" /> {t('common.new_app')}
                </Button>
            </header>

            <div className="flex-1 p-6 overflow-auto">
                <div className="rounded-md border bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]"></TableHead>
                                <TableHead>{t('apps.name')}</TableHead>
                                <TableHead>{t('apps.prefix')}</TableHead>
                                <TableHead>{t('apps.creation_date')}</TableHead>
                                <TableHead className="text-right">{t('common.actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {projects.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        {t('apps.no_apps')}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                projects.map((project) => (
                                    <TableRow key={project.id}>
                                        <TableCell>
                                            <div className="w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: project.color }}>
                                                {project.name[0]}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">{project.name}</TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center px-2 py-1 rounded-md bg-muted text-xs font-mono">
                                                {project.prefix}
                                            </span>
                                        </TableCell>
                                        <TableCell>{project.createdAt ? new Date(project.createdAt).toLocaleDateString() : "-"}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">{t('common.open_menu')}</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>{t('common.actions')}</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleEdit(project)}>
                                                        <Pencil className="mr-2 h-4 w-4" /> {t('common.edit')}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(project.id)}>
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
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{editingId ? t('apps.edit_app') : t('apps.create_app')}</DialogTitle>
                        <DialogDescription>
                            {editingId ? t('apps.edit_desc') : t('apps.create_desc')}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">{t('apps.name')}</Label>
                            <Input id="name" placeholder="FlowOS" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="prefix">{t('apps.prefix')}</Label>
                                <Input id="prefix" placeholder="FLOW" value={formData.prefix} onChange={e => setFormData({ ...formData, prefix: e.target.value.toUpperCase() })} required maxLength={5} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="color">{t('apps.color')}</Label>
                                <div className="flex items-center gap-2">
                                    <Input id="color" type="color" className="w-12 h-10 p-1" value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} />
                                    <Input value={formData.color} onChange={e => setFormData({ ...formData, color: e.target.value })} />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingId ? t('common.save') : t('common.create'))}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>


            <ConfirmDialog
                isOpen={!!deleteProjectId}
                onClose={() => setDeleteProjectId(null)}
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
