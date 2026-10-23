import { describe, expect, it } from "vitest";
import {
    agentAuthKind,
    bearer,
    expiryFor,
    hashToken,
    looksLikeToken,
    missingScope,
    newToken,
    safeEqual,
    shouldTouch,
    tokenUsable,
    validateScopes,
    validateTokenName,
} from "./tokens";

describe("tokens", () => {
    it("generates vb_ + 32 bytes base64url, hashes to sha256 hex", () => {
        const t = newToken();
        expect(looksLikeToken(t)).toBe(true);
        expect(newToken()).not.toBe(t);
        expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
        expect(hashToken(t)).toBe(hashToken(t));
    });
    it("rejects malformed tokens", () => {
        expect(looksLikeToken("vb_short")).toBe(false);
        expect(looksLikeToken("xx_" + "a".repeat(43))).toBe(false);
        expect(looksLikeToken("vb_" + "a".repeat(42) + "=")).toBe(false);
    });
    it("reads the bearer header", () => {
        expect(bearer(new Request("http://x", { headers: { authorization: "Bearer abc " } }))).toBe("abc");
        expect(bearer(new Request("http://x", { headers: { authorization: "Basic abc" } }))).toBe("");
        expect(bearer(new Request("http://x"))).toBe("");
    });
    it("compares in constant time regardless of length", () => {
        expect(safeEqual("Bearer s", "Bearer s")).toBe(true);
        expect(safeEqual("Bearer s", "Bearer s2")).toBe(false);
        expect(safeEqual("", "x")).toBe(false);
    });
    it("touches last_used_at at most once per minute", () => {
        const now = Date.parse("2026-10-23T12:00:00Z");
        expect(shouldTouch(null, now)).toBe(true);
        expect(shouldTouch("2026-10-23T11:59:30Z", now)).toBe(false);
        expect(shouldTouch("2026-10-23T11:59:00Z", now)).toBe(true);
    });
    it("validates the token name", () => {
        expect(validateTokenName("  Jarvis ")).toBe("Jarvis");
        expect(validateTokenName("")).toBeNull();
        expect(validateTokenName("x".repeat(101))).toBeNull();
        expect(validateTokenName(3)).toBeNull();
    });
    it("agent-tasks: legacy secret wins first, even when it starts with vb_", () => {
        const vbSecret = "vb_" + "a".repeat(43);
        expect(agentAuthKind(`Bearer ${vbSecret}`, vbSecret)).toBe("legacy");
        expect(agentAuthKind("Bearer hook", "hook")).toBe("legacy");
        expect(agentAuthKind(`Bearer ${vbSecret}`, "hook")).toBe("token");
        expect(agentAuthKind(`Bearer ${vbSecret}`, undefined)).toBe("token");
        expect(agentAuthKind("Bearer wrong", "hook")).toBe("none");
        expect(agentAuthKind(null, "hook")).toBe("none");
        expect(agentAuthKind("Bearer ", "")).toBe("none");
    });
});

describe("token scopes", () => {
    it("missingScope: null when granted, else the 403 message", () => {
        expect(missingScope(["read", "write"], "read")).toBeNull();
        expect(missingScope(["read", "write"], "agent")).toBe("missing scope agent");
        expect(missingScope([], "read")).toBe("missing scope read");
    });
    it("validateScopes: default read+write, non-empty subset, deduped in canonical order", () => {
        expect(validateScopes(undefined)).toEqual(["read", "write"]);
        expect(validateScopes(["agent", "read", "agent"])).toEqual(["read", "agent"]);
        expect(validateScopes([])).toBeNull();
        expect(validateScopes(["admin"])).toBeNull();
        expect(validateScopes("read")).toBeNull();
    });
});

describe("token expiry", () => {
    const now = Date.parse("2026-10-23T12:00:00Z");
    it("expiryFor: default 90 days, null = never, only 30/90/365", () => {
        expect(expiryFor(undefined, now)).toEqual({ expiresAt: "2027-01-21T12:00:00.000Z" });
        expect(expiryFor(30, now)).toEqual({ expiresAt: "2026-11-22T12:00:00.000Z" });
        expect(expiryFor(null, now)).toEqual({ expiresAt: null });
        expect(expiryFor(7, now)).toBeNull();
        expect(expiryFor("90", now)).toBeNull();
    });
    it("tokenUsable: needs user_id, not revoked, not expired", () => {
        const ok = { user_id: "u", revoked_at: null, expires_at: null };
        expect(tokenUsable(ok, now)).toBe(true);
        expect(tokenUsable({ ...ok, user_id: null }, now)).toBe(false); // pre-user_id token: recreate
        expect(tokenUsable({ ...ok, revoked_at: "2026-10-01T00:00:00Z" }, now)).toBe(false);
        expect(tokenUsable({ ...ok, expires_at: "2026-10-23T11:59:59Z" }, now)).toBe(false);
        expect(tokenUsable({ ...ok, expires_at: "2026-10-23T12:00:00Z" }, now)).toBe(false);
        expect(tokenUsable({ ...ok, expires_at: "2026-10-24T00:00:00Z" }, now)).toBe(true);
    });
});
