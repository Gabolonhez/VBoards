"use client";

import { useEffect, useState } from "react";
import { TeamList } from "@/components/team/team-list";
import { getMembers } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { TeamMember } from "@/types";
import { Loader2 } from "lucide-react";

export default function TeamPage() {
    const { organization } = useAuth();
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadMembers() {
            if (!organization) {
                setLoading(false);
                return;
            }
            try {
                setLoading(true);
                const data = await getMembers(organization.id);
                setMembers(data);
            } catch (error) {
                console.error("Failed to load members", error);
            } finally {
                setLoading(false);
            }
        }
        loadMembers();
    }, [organization]);

    if (loading) return (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="animate-spin h-8 w-8 text-primary" />
        </div>
    );

    return (
        <div className="h-full bg-background flex flex-col p-8">
            <TeamList initialMembers={members} onRefresh={() => {
                if (organization) getMembers(organization.id).then(setMembers)
            }} />
        </div>
    );
}
