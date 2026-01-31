"use client";

import { Bell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage } from "@/context/language-context";

interface HeaderProps {
    title: string;
    description?: string;
    hideAddButton?: boolean;
}

export function Header({ title, description, hideAddButton }: HeaderProps) {
    const { t } = useLanguage();

    return (
        <header className="flex items-center justify-between h-16 px-6 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div>
                <h1 className="text-xl font-semibold text-foreground">{title}</h1>
                {description && (
                    <p className="text-sm text-muted-foreground">{description}</p>
                )}
            </div>

            <div className="flex items-center gap-3">
                {!hideAddButton && (
                    <Button className="gap-2 bg-primary hover:bg-primary/90">
                        <Plus className="h-4 w-4" />
                        <span>{t('common.new_task')}</span>
                    </Button>
                )}

                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
                </Button>

                <Avatar className="h-8 w-8">
                    <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=User" />
                    <AvatarFallback>U</AvatarFallback>
                </Avatar>
            </div>
        </header>
    );
}
