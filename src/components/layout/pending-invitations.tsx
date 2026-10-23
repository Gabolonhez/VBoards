"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";
import { acceptInvitation, getPendingInvitations } from "@/lib/api";

type Invite = Awaited<ReturnType<typeof getPendingInvitations>>[number];

// Invitations to the logged-in user's email, accepted only by an explicit click (never automatically on login).
export function PendingInvitations() {
    const { user, refreshOrganizations } = useAuth();
    const { t } = useLanguage();
    const { toast } = useToast();
    const [invites, setInvites] = useState<Invite[]>([]);

    useEffect(() => {
        if (!user) return;
        // Fails quietly until supabase/fix_org_members_insert.sql is applied
        getPendingInvitations().then(setInvites).catch(() => setInvites([]));
    }, [user]);

    const accept = async (invite: Invite) => {
        try {
            await acceptInvitation(invite.id);
            setInvites((prev) => prev.filter((i) => i.id !== invite.id));
            await refreshOrganizations();
        } catch {
            toast({ title: t("team.invite_accept_error"), variant: "destructive" });
        }
    };

    if (!user || !invites.length) return null;
    return (
        <div className="border-b border-border bg-primary/5">
            {invites.map((invite) => (
                <div key={invite.id} className="flex items-center gap-3 px-6 py-2 text-sm">
                    <p className="flex-1 min-w-0 truncate text-foreground">
                        {t("team.invite_pending_banner")} <strong>{invite.organizationName}</strong>
                    </p>
                    <Button size="sm" onClick={() => accept(invite)}>
                        {t("team.invite_accept")}
                    </Button>
                </div>
            ))}
        </div>
    );
}
