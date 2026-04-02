import { Profile, Project, Version, Task, Activity, TeamMember } from "@/types";

// Users
export const users: Profile[] = [
    {
        id: "1",
        full_name: "Sarah Chen",
        avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
        email: "sarah@vboards.app",
    },
    {
        id: "2",
        full_name: "Mike Johnson",
        avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike",
        email: "mike@vboards.app",
    },
    {
        id: "3",
        full_name: "Alex Kim",
        avatar_url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
        email: "alex@vboards.app",
    },
];

// Projects
export const projects: Project[] = [
    {
        id: "1",
        name: "FitTracker",
        prefix: "FIT",
        color: "#3b82f6",
    },
    {
        id: "2",
        name: "ShopEase",
        prefix: "SHOP",
        color: "#10b981",
    },
];

// Versions
export const versions: Version[] = [
    {
        id: "1",
        projectId: "1",
        name: "v1.9.4",
        status: "in_development",
        releaseDate: "2026-01-20",
        notes: "Heart rate monitoring, calorie fixes",
    },
    {
        id: "2",
        projectId: "1",
        name: "v1.9.3",
        status: "in_stores",
        releaseDate: "2026-01-05",
        notes: "Bug fixes and performance improvements",
    },
    {
        id: "3",
        projectId: "2",
        name: "v2.1.0",
        status: "in_development",
        releaseDate: "2026-02-01",
        notes: "New checkout flow",
    },
];

// Team Members
export const members: TeamMember[] = users.map(user => ({
    id: user.id,
    name: user.full_name || 'Unknown',
    nickname: user.full_name?.split(' ')[0],
    role: 'Member',
    avatarUrl: user.avatar_url,
    createdAt: new Date().toISOString()
}));

// Tasks
export const tasks: Task[] = [
    {
        id: "1",
        projectId: "1",
        versionId: "1",
        code: "FIT-74",
        title: "Implement heart rate monitoring",
        description: "Add real-time heart rate tracking during workouts",
        status: "in_progress",
        priority: "high",
        assignee: members[0],
        createdAt: "2026-01-10T10:00:00Z",
        updatedAt: "2026-01-14T02:00:00Z",
    },
    {
        id: "2",
        projectId: "1",
        versionId: "1",
        code: "FIT-73",
        title: "Fix calorie calculation bug",
        description: "Calories are not being calculated correctly for certain activities",
        status: "code_review",
        priority: "critical",
        assignee: members[1],
        createdAt: "2026-01-09T14:00:00Z",
        updatedAt: "2026-01-13T18:00:00Z",
    },
    {
        id: "3",
        projectId: "1",
        versionId: "1",
        code: "FIT-72",
        title: "Add social sharing feature",
        description: "Allow users to share workout summaries on social media",
        status: "backlog",
        priority: "medium",
        createdAt: "2026-01-08T09:00:00Z",
        updatedAt: "2026-01-08T09:00:00Z",
    },
    {
        id: "4",
        projectId: "1",
        versionId: "1",
        code: "FIT-71",
        title: "Redesign workout summary screen",
        description: "Update the workout summary screen with new UI components",
        status: "done",
        priority: "medium",
        assignee: members[0],
        createdAt: "2026-01-05T11:00:00Z",
        updatedAt: "2026-01-12T16:00:00Z",
    },
    {
        id: "5",
        projectId: "1",
        versionId: "1",
        code: "FIT-70",
        title: "AI workout recommendations",
        description: "Implement AI-powered workout suggestions based on user history",
        status: "ideas",
        priority: "low",
        createdAt: "2026-01-04T08:00:00Z",
        updatedAt: "2026-01-04T08:00:00Z",
    },
    {
        id: "6",
        projectId: "2",
        versionId: "3",
        code: "SHOP-42",
        title: "Implement new checkout flow",
        description: "Complete redesign of the checkout process",
        status: "in_progress",
        priority: "high",
        assignee: members[2],
        createdAt: "2026-01-11T10:00:00Z",
        updatedAt: "2026-01-14T01:00:00Z",
    },
];

// Activity Feed
export const activities: Activity[] = [
    {
        id: "1",
        userId: "1",
        user: users[0],
        action: "completed",
        entityId: "4",
        taskCode: "FIT-71",
        timestamp: "2026-01-14T00:00:00Z",
    },
    {
        id: "2",
        userId: "2",
        user: users[1],
        action: "moved",
        entityId: "2",
        taskCode: "FIT-73",
        details: "to Code Review",
        timestamp: "2026-01-13T20:00:00Z",
    },
    {
        id: "3",
        userId: "3",
        user: users[2],
        action: "started",
        entityId: "6",
        taskCode: "SHOP-42",
        timestamp: "2026-01-13T15:00:00Z",
    },
];

// Helper functions
export function getTasksByStatus(status: Task["status"]): Task[] {
    return tasks.filter((task) => task.status === status);
}

export function getTasksByVersion(versionId: string): Task[] {
    return tasks.filter((task) => task.versionId === versionId);
}

export function getVersionById(id: string): Version | undefined {
    return versions.find((v) => v.id === id);
}

export function getProjectById(id: string): Project | undefined {
    return projects.find((p) => p.id === id);
}

export function getVersionByName(name: string): Version | undefined {
    return versions.find((v) => v.name === name);
}
