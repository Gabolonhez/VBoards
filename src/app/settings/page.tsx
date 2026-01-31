"use client";

import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    User,
    Bell,
    Palette,
    Keyboard,
    Database,
    Shield,
    ChevronRight,
} from "lucide-react";
import { useLanguage } from "@/context/language-context";

export default function SettingsPage() {
    const { t } = useLanguage();

    const settingsSections = [
        {
            id: "profile",
            title: t('settings.profile'),
            description: t('settings.profile_desc'),
            icon: User,
            badge: null,
        },
        {
            id: "notifications",
            title: t('settings.notifications'),
            description: t('settings.notifications_desc'),
            icon: Bell,
            badge: null,
        },
        {
            id: "appearance",
            title: t('settings.appearance'),
            description: t('settings.appearance_desc'),
            icon: Palette,
            badge: t('settings.badges.dark'),
        },
        {
            id: "shortcuts",
            title: t('settings.shortcuts'),
            description: t('settings.shortcuts_desc'),
            icon: Keyboard,
            badge: null,
        },
        {
            id: "data",
            title: t('settings.data'),
            description: t('settings.data_desc'),
            icon: Database,
            badge: null,
        },
        {
            id: "security",
            title: t('settings.security'),
            description: t('settings.security_desc'),
            icon: Shield,
            badge: t('settings.badges.enabled'),
        },
    ];

    return (
        <div className="flex flex-col h-full">
            <Header title={t('settings.title')} description={t('settings.subtitle')} hideAddButton />

            <div className="flex-1 p-6 overflow-auto">
                <div className="max-w-2xl mx-auto">
                    <div className="bg-card rounded-xl border border-border overflow-hidden">
                        {settingsSections.map((section, index) => (
                            <div key={section.id}>
                                <button className="w-full flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors text-left">
                                    <div className="p-2 rounded-lg bg-muted">
                                        <section.icon className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-medium text-foreground">
                                                {section.title}
                                            </h3>
                                            {section.badge && (
                                                <Badge
                                                    variant="secondary"
                                                    className="text-[10px] bg-primary/10 text-primary border-0"
                                                >
                                                    {section.badge}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            {section.description}
                                        </p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </button>
                                {index < settingsSections.length - 1 && (
                                    <Separator className="bg-border" />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Danger Zone */}
                    <div className="mt-6 bg-card rounded-xl border border-destructive/30 overflow-hidden">
                        <div className="p-4">
                            <h3 className="text-sm font-medium text-destructive mb-1">
                                {t('settings.danger_zone')}
                            </h3>
                            <p className="text-xs text-muted-foreground mb-3">
                                {t('settings.danger_desc')}
                            </p>
                            <div className="flex gap-3">

                                <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/10">
                                    {t('settings.delete_account')}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* App Info */}
                    <div className="mt-6 text-center text-xs text-muted-foreground">
                        <p>VBoards v2.0.0</p>
                        <p className="mt-1">© 2026 VBoards. {t('settings.rights')}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
