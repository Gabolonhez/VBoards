import { describe, expect, it } from "vitest";
import { normalizeEmail, selectMembers } from "./identity";

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

it("normalizeEmail trims and lowercases, non-strings become empty", () => {
    expect(normalizeEmail("  A@B.com ")).toBe("a@b.com");
    expect(normalizeEmail(undefined)).toBe("");
    expect(normalizeEmail(42)).toBe("");
});
