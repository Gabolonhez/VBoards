"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { Organization, Profile } from "@/types";
import { getOrganizations } from "@/lib/api";

interface AuthContextType {
    user: User | null;
    session: Session | null;
    profile: Profile | null;
    organization: Organization | null;
    organizations: Organization[];
    isLoading: boolean;
    setOrganization: (org: Organization | null) => void;
    refreshOrganizations: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [organization, setOrganizationState] = useState<Organization | null>(null);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session) {
                loadUserData();
            } else {
                setProfile(null);
                setOrganizationState(null);
                setOrganizations([]);
                setIsLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, [supabase]);

    async function loadUserData() {
        setIsLoading(true);
        try {
            // Load organizations
            const orgs = await getOrganizations();
            setOrganizations(orgs);

            // Restore organization selection
            const savedOrgId = localStorage.getItem("flowos_selected_org_id");
            const savedOrg = orgs.find(o => o.id === savedOrgId);
            if (savedOrg) {
                setOrganizationState(savedOrg);
            } else if (orgs.length > 0) {
                setOrganizationState(orgs[0]);
            }
        } catch (error) {
            console.error("Error loading user data:", error);
        } finally {
            setIsLoading(false);
        }
    }

    const setOrganization = (org: Organization | null) => {
        setOrganizationState(org);
        if (org) {
            localStorage.setItem("flowos_selected_org_id", org.id);
        } else {
            localStorage.removeItem("flowos_selected_org_id");
        }
    };

    const refreshOrganizations = async () => {
        const orgs = await getOrganizations();
        setOrganizations(orgs);
        if (!organization && orgs.length > 0) {
            setOrganization(orgs[0]);
        }
    };

    const signOut = async () => {
        await supabase.auth.signOut();
        setOrganization(null);
    };

    return (
        <AuthContext.Provider value={{
            user,
            session,
            profile,
            organization,
            organizations,
            isLoading,
            setOrganization,
            refreshOrganizations,
            signOut
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
