
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Project } from "@/types";
import { getProjects } from "@/lib/api";
import { useAuth } from "@/context/auth-context";

interface ProjectContextType {
    projects: Project[];
    selectedProjectId: string | null; // null means "All Projects"
    selectedProject: Project | null;
    setSelectedProjectId: (id: string | null) => void;
    isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
    const { organization, isLoading: authLoading } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectIdState] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadProjects() {
            if (authLoading) return;
            if (!organization) {
                setProjects([]);
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                const data = await getProjects(organization.id);
                setProjects(data);

                // Try to restore from local storage
                const savedIds = localStorage.getItem(`flowos_selected_project_id_${organization.id}`);
                if (savedIds && data.some(p => p.id === savedIds)) {
                    setSelectedProjectIdState(savedIds);
                } else {
                    setSelectedProjectIdState(null);
                }
            } catch (error) {
                console.error("Failed to load projects", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadProjects();
    }, [organization, authLoading]);

    const setSelectedProjectId = (id: string | null) => {
        setSelectedProjectIdState(id);
        if (id && organization) {
            localStorage.setItem(`flowos_selected_project_id_${organization.id}`, id);
        } else if (organization) {
            localStorage.removeItem(`flowos_selected_project_id_${organization.id}`);
        }
    };

    const selectedProject = projects.find(p => p.id === selectedProjectId) || null;

    return (
        <ProjectContext.Provider value={{
            projects,
            selectedProjectId,
            selectedProject,
            setSelectedProjectId,
            isLoading
        }}>
            {children}
        </ProjectContext.Provider>
    );
}

export function useProject() {
    const context = useContext(ProjectContext);
    if (context === undefined) {
        throw new Error("useProject must be used within a ProjectProvider");
    }
    return context;
}
