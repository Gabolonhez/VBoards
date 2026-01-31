"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
    LayoutDashboard,
    Columns3,
    Map,
    FileText,
    Settings,
    ChevronLeft,
    ChevronsUpDown,
    Check,
    LayoutGrid,
    User,
    Edit,
    Trash,
    AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useProject } from "@/context/project-context";
import { useLanguage } from "@/context/language-context";
import { useAuth } from "@/context/auth-context";
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar";
import {
    LogOut,
    Building2,
    PlusCircle
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { createOrganization, updateOrganization, deleteOrganization } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const { projects, selectedProject, selectedProjectId, setSelectedProjectId } = useProject();
    const { language, setLanguage, t } = useLanguage();
    const { user, organization, organizations, setOrganization, signOut, refreshOrganizations } = useAuth();
    const { toast } = useToast();

    const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);
    const [newOrgName, setNewOrgName] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Edit/Delete States
    const [isEditOrgOpen, setIsEditOrgOpen] = useState(false);
    const [editOrgName, setEditOrgName] = useState("");
    const [isDeleteOrgOpen, setIsDeleteOrgOpen] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState("");

    async function handleUpdateOrg() {
        if (!organization || !editOrgName.trim()) return;

        setIsLoading(true);
        try {
            await updateOrganization(organization.id, editOrgName);
            await refreshOrganizations();
            // Update current organization object locally to reflect name change immediately if needed, 
            // but refreshOrganizations should handle it if context updates. 
            // We might need to manually update the local 'organization' reference if it's not reactive deep enough or just wait.
            // Ideally setOrganization({...organization, name: editOrgName}) but let's see.
            // For now, simple toast.
            setIsEditOrgOpen(false);
            toast({
                title: "Organização atualizada!",
                description: "O nome da organização foi alterado com sucesso.",
            });
        } catch (error) {
            console.error(error);
            toast({
                title: "Erro ao atualizar",
                description: "Não foi possível atualizar a organização.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }

    async function handleDeleteOrg() {
        if (!organization || deleteConfirmation !== organization.name) return;

        setIsLoading(true);
        try {
            await deleteOrganization(organization.id);
            await refreshOrganizations();

            // We need to switch to another org. 
            // The context might not auto-switch.
            // We can reload the page or try to pick one.
            window.location.reload(); // Simplest way to reset state and pick first available or show empty state

        } catch (error) {
            console.error(error);
            toast({
                title: "Erro ao excluir",
                description: "Não foi possível excluir a organização.",
                variant: "destructive",
            });
            setIsLoading(false);
        }
    }

    async function handleCreateOrg() {
        if (!newOrgName.trim()) return;

        setIsLoading(true);
        try {
            const newOrg = await createOrganization(newOrgName);
            await refreshOrganizations(); // Refresh the list
            setOrganization(newOrg); // Switch to new org
            setIsCreateOrgOpen(false);
            setNewOrgName("");
            toast({
                title: "Organização criada!",
                description: `A organização ${newOrg.name} foi criada com sucesso.`,
            });
        } catch (error) {
            console.error(error);
            toast({
                title: "Erro ao criar organização",
                description: "Não foi possível criar a organização. Tente novamente.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    }

    const navigation = [
        { name: t('common.dashboard'), href: "/", icon: LayoutDashboard },
        { name: t('common.board'), href: "/board", icon: Columns3 },
        { name: t('common.roadmap'), href: "/roadmap", icon: Map },
        { name: t('common.processes'), href: "/processes", icon: FileText },
        { name: t('team.menu'), href: "/team", icon: User },
        { name: t('common.apps'), href: "/apps", icon: LayoutGrid },
        { name: t('common.settings'), href: "/settings", icon: Settings },
    ];

    const getFlag = (lang: string) => {
        switch (lang) {
            case 'pt': return '🇧🇷';
            case 'es': return '🇪🇸';
            case 'en': return '🇺🇸';
            default: return '🌐';
        }
    };

    return (
        <aside
            className={cn(
                "flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
                collapsed ? "w-16" : "w-64"
            )}
        >
            {/* Header / Project Switcher */}
            <div className="flex flex-col border-b border-sidebar-border">
                {/* Branding Section */}
                <div className="flex items-center gap-3 h-14 px-4">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 overflow-hidden relative">
                        <Image src="/logo.png" alt="VBoards" fill className="object-cover" />
                    </div>
                    {!collapsed && <span className="font-bold text-xl tracking-tight text-sidebar-foreground">VBoards</span>}
                    {!collapsed && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 ml-auto text-muted-foreground hover:text-sidebar-foreground"
                            onClick={() => setCollapsed(true)}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                {/* Organization Switcher (Expanded) */}
                {!collapsed && (
                    <div className="px-4 pb-4">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full justify-start px-2 gap-2 h-9 text-xs border-dashed border-stone-700 bg-stone-900/50 hover:bg-stone-800">
                                    <Building2 className="h-3.5 w-3.5 text-stone-500" />
                                    <span className="truncate flex-1 text-left">{organization?.name || "Sem Org"}</span>
                                    <ChevronsUpDown className="h-3 w-3 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="start">
                                <DropdownMenuLabel>Sua Organização</DropdownMenuLabel>
                                {organization && (
                                    <>
                                        <DropdownMenuItem onSelect={() => {
                                            setEditOrgName(organization.name);
                                            setIsEditOrgOpen(true);
                                        }}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Editar Nome
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onSelect={() => {
                                                setDeleteConfirmation("");
                                                setIsDeleteOrgOpen(true);
                                            }}
                                        >
                                            <Trash className="mr-2 h-4 w-4" />
                                            Excluir Organização
                                        </DropdownMenuItem>
                                    </>
                                )}
                                <DropdownMenuSeparator />
                                {organizations.map(org => (
                                    <DropdownMenuItem key={org.id} onClick={() => setOrganization(org)}>
                                        <div className="flex items-center gap-2 w-full">
                                            <span className="truncate flex-1">{org.name}</span>
                                            {organization?.id === org.id && <Check className="h-4 w-4" />}
                                        </div>
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="gap-2 text-blue-500" onSelect={() => setIsCreateOrgOpen(true)}>
                                    <PlusCircle className="h-4 w-4" />
                                    Nova Organização
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}

                {/* Project Switcher */}
                {!collapsed && (
                    <div className="px-4 pb-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="w-full justify-start px-2 gap-2 font-semibold hover:bg-sidebar-accent truncate border border-sidebar-border bg-sidebar-accent/50">
                                    <div className="w-6 h-6 rounded bg-primary/20 text-primary flex items-center justify-center shrink-0">
                                        {selectedProject ? selectedProject.name[0] : "A"}
                                    </div>
                                    <span className="truncate">{selectedProject ? selectedProject.name : t('common.all_projects')}</span>
                                    <ChevronsUpDown className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="start">
                                <DropdownMenuLabel>{t('common.select_project')}</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setSelectedProjectId(null)}>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-slate-500/20 flex items-center justify-center border text-[10px]">A</div>
                                        <span>{t('common.all_projects')}</span>
                                        {selectedProjectId === null && <Check className="ml-auto h-4 w-4" />}
                                    </div>
                                </DropdownMenuItem>
                                {projects.map(project => (
                                    <DropdownMenuItem key={project.id} onClick={() => setSelectedProjectId(project.id)}>
                                        <div className="flex items-center gap-2 w-full">
                                            <div className="w-4 h-4 rounded bg-primary/20 flex items-center justify-center text-[10px]" style={{ color: project.color }}>
                                                {project.name[0]}
                                            </div>
                                            <span>{project.name}</span>
                                            {selectedProjectId === project.id && <Check className="ml-auto h-4 w-4" />}
                                        </div>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
            </div>



            {/* Navigation */}
            <nav className="flex-1 px-3 py-2 space-y-1">
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-primary text-primary-foreground"
                                    : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
                            )}
                        >
                            <item.icon className="h-5 w-5 flex-shrink-0" />
                            {!collapsed && <span>{item.name}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* Language Switcher */}
            <div className="p-3 border-t border-sidebar-border">
                {!collapsed ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="w-full justify-start px-2 gap-2 text-sm text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent">
                                <span className="text-base leading-none">{getFlag(language)}</span>
                                <span className="flex-1 text-left">
                                    {language === 'pt' ? 'Português' : language === 'es' ? 'Español' : 'English'}
                                </span>
                                <ChevronsUpDown className="h-4 w-4 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[180px]">
                            <DropdownMenuLabel>{t('common.select_language')}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setLanguage('en')}>
                                <span className="mr-2">🇺🇸</span> English
                                {language === 'en' && <Check className="ml-auto h-4 w-4" />}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLanguage('pt')}>
                                <span className="mr-2">🇧🇷</span> Português
                                {language === 'pt' && <Check className="ml-auto h-4 w-4" />}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLanguage('es')}>
                                <span className="mr-2">🇪🇸</span> Español
                                {language === 'es' && <Check className="ml-auto h-4 w-4" />}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="w-full h-8">
                                <span className="text-base">{getFlag(language)}</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="ml-2">
                            <DropdownMenuItem onClick={() => setLanguage('en')} className="gap-2">🇺🇸 English</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLanguage('pt')} className="gap-2">🇧🇷 Português</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLanguage('es')} className="gap-2">🇪🇸 Español</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>

            {/* User Profile */}
            <div className="p-3 border-t border-sidebar-border mt-auto">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className={cn("w-full justify-start gap-2", collapsed ? "px-0 justify-center" : "px-2")}>
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={user?.user_metadata?.avatar_url} />
                                <AvatarFallback className="bg-stone-800 text-stone-300">
                                    {user?.user_metadata?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
                                </AvatarFallback>
                            </Avatar>
                            {!collapsed && (
                                <div className="flex flex-col items-start truncate">
                                    <span className="text-sm font-medium truncate w-full text-left">
                                        {user?.user_metadata?.full_name || "Usuário"}
                                    </span>
                                    <span className="text-xs text-stone-500 truncate w-full text-left">
                                        {user?.email}
                                    </span>
                                </div>
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={collapsed ? "start" : "end"} className="w-56" side={collapsed ? "right" : "top"} sideOffset={12}>
                        <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                            <Settings className="mr-2 h-4 w-4" />
                            Configurações
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => signOut()}>
                            <LogOut className="mr-2 h-4 w-4" />
                            Sair
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Collapse Button */}
            <div className="p-1">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCollapsed(!collapsed)}
                    className="w-full flex items-center justify-center text-muted-foreground hover:text-sidebar-foreground"
                >
                    <ChevronLeft
                        className={cn(
                            "h-4 w-4 transition-transform",
                            collapsed && "rotate-180"
                        )}
                    />
                </Button>
            </div>

            <Dialog open={isCreateOrgOpen} onOpenChange={setIsCreateOrgOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nova Organização</DialogTitle>
                        <DialogDescription>
                            Crie uma nova organização para gerenciar seus projetos e equipe.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="org-name">Nome da Organização</Label>
                            <Input
                                id="org-name"
                                placeholder="Ex: Acme Inc."
                                value={newOrgName}
                                onChange={(e) => setNewOrgName(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOrgOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleCreateOrg} disabled={isLoading || !newOrgName.trim()}>
                            {isLoading ? "Criando..." : "Criar Organização"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Org Dialog */}
            <Dialog open={isEditOrgOpen} onOpenChange={setIsEditOrgOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Organização</DialogTitle>
                        <DialogDescription>
                            Altere o nome da sua organização.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-org-name">Nome da Organização</Label>
                            <Input
                                id="edit-org-name"
                                value={editOrgName}
                                onChange={(e) => setEditOrgName(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOrgOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleUpdateOrg} disabled={isLoading || !editOrgName.trim()}>
                            {isLoading ? "Salvando..." : "Salvar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Org Dialog */}
            <Dialog open={isDeleteOrgOpen} onOpenChange={setIsDeleteOrgOpen}>
                <DialogContent className="border-destructive border-2">
                    <DialogHeader>
                        <DialogTitle className="text-destructive flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Excluir Organização
                        </DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja excluir a organização <strong>{organization?.name}</strong>?
                            <br /><br />
                            Esta ação é irreversível e excluirá todos os projetos, tarefas e membros associados.
                            <br /><br />
                            Digite <strong>{organization?.name}</strong> abaixo para confirmar.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="delete-confirm">Confirmação</Label>
                            <Input
                                id="delete-confirm"
                                value={deleteConfirmation}
                                onChange={(e) => setDeleteConfirmation(e.target.value)}
                                placeholder={organization?.name}
                                className="border-destructive/50 focus-visible:ring-destructive"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOrgOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteOrg}
                            disabled={isLoading || deleteConfirmation !== organization?.name}
                        >
                            {isLoading ? "Excluindo..." : "Excluir Organização"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </aside >
    );
}
