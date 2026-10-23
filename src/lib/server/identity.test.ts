import { describe, expect, it } from "vitest";
import { normalizeEmail, pickLegacyUser, selectMembers } from "./identity";

const U = "user-victim";
const row = (id: string, user_id: string | null, organization_id: string) => ({ id, user_id, organization_id });

describe("selectMembers", () => {
    it("keeps only rows linked to the user in orgs where organization_members has them", () => {
        const rows = [
            row("own", U, "orgV"),
            row("placeholder", null, "orgAttacker"), // invite placeholder with the victim's email, no user_id
            row("forged", U, "orgAttacker"), // user_id written by an attacker; victim not in that org
            row("other", "someone", "orgV"),
        ];
        expect(selectMembers(U, rows, ["orgV"]).map((r) => r.id)).toEqual(["own"]);
    });
    it("returns nothing without a user id", () => {
        expect(selectMembers("", [row("x", null, "o")], ["o"])).toEqual([]);
    });
    it("includes accepted invites (linked + org membership)", () => {
        expect(selectMembers(U, [row("a", U, "o1"), row("b", U, "o2")], ["o1", "o2"]).map((r) => r.id)).toEqual(["a", "b"]);
    });
});

describe("pickLegacyUser", () => {
    const auth: Record<string, string> = { victim: "Victim@Example.com", attacker: "attacker@evil.com" };
    const lookup = async (id: string) => auth[id] ?? null;
    it("picks the candidate whose own auth email matches exactly", async () => {
        expect(await pickLegacyUser("victim@example.com", ["attacker", "victim"], lookup)).toBe("victim");
    });
    it("rejects candidates whose row email was edited to someone else's", async () => {
        expect(await pickLegacyUser("victim@example.com", ["attacker", null], lookup)).toBe("");
    });
    it("no wildcards: _ and % are literal", async () => {
        expect(await pickLegacyUser("v_ctim@example.com", ["victim"], lookup)).toBe("");
        expect(await pickLegacyUser("%@example.com", ["victim"], lookup)).toBe("");
    });
    it("empty email resolves to nobody", async () => {
        expect(await pickLegacyUser("", ["victim"], lookup)).toBe("");
    });
});

it("normalizeEmail trims and lowercases, non-strings become empty", () => {
    expect(normalizeEmail("  A@B.com ")).toBe("a@b.com");
    expect(normalizeEmail(undefined)).toBe("");
    expect(normalizeEmail(42)).toBe("");
});
