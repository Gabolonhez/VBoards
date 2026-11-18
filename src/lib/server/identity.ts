// Pure identity rules for the machine-to-machine routes. Identity is the Supabase auth user id, never an email:
// team_members.email is free text any org member can write (and invites create rows with only an email).

export const normalizeEmail = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "");

/**
 * The caller's team_members rows: linked to their auth user id AND in an organization where organization_members
 * says they belong. RLS lets any member of an org write team_members.user_id, so the row alone proves nothing.
 */
export function selectMembers<T extends { user_id: string | null; organization_id: string }>(userId: string, rows: T[], memberOrgIds: string[]): T[] {
    if (!userId) return [];
    const orgs = new Set(memberOrgIds);
    return rows.filter((r) => r.user_id === userId && orgs.has(r.organization_id));
}
