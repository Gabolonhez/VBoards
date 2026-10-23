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

/**
 * Legacy auth (COMMIT_HOOK_SECRET + email): the auth user whose own email is exactly `email`, among the user ids of
 * team_members rows carrying that email. Each candidate is checked against auth.users, so a row whose email was
 * edited to someone else's cannot hand over that person's identity.
 */
export async function pickLegacyUser(email: string, candidateIds: (string | null)[], authEmail: (id: string) => Promise<string | null>): Promise<string> {
    if (!email) return "";
    for (const id of new Set(candidateIds.filter((x): x is string => !!x))) {
        if (normalizeEmail(await authEmail(id)) === email) return id;
    }
    return "";
}
