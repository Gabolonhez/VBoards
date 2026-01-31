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
    User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useProject } from "@/context/project-context";
import { useLanguage } from "@/context/language-context";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const { projects, selectedProject, selectedProjectId, setSelectedProjectId } = useProject();
    const { language, setLanguage, t } = useLanguage();

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

                {/* Project Switcher */}
                {!collapsed && (
                    <div className="px-4 pb-4">
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

                {collapsed && (
                    <div className="flex items-center justify-center h-10 px-4 mb-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-sidebar-foreground"
                            onClick={() => setCollapsed(false)}
                        >
                            <ChevronLeft className="h-4 w-4 rotate-180" />
                        </Button>
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

            {/* Collapse Button */}
            <div className="p-3">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                >
                    <ChevronLeft
                        className={cn(
                            "h-5 w-5 transition-transform",
                            collapsed && "rotate-180"
                        )}
                    />
                    {!collapsed && <span>{t('common.collapse')}</span>}
                </button>
            </div>
        </aside>
    );
}
