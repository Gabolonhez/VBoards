"use client";

import { useEffect, useState } from "react";
import { Copy, KeyRound, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/context/language-context";
import { useToast } from "@/hooks/use-toast";

interface ApiToken {
    id: string;
    name: string;
    createdAt: string;
    lastUsedAt: string | null;
    expiresAt: string | null;
    scopes: string[];
}

// Same lists as TOKEN_SCOPES / TOKEN_EXPIRY_DAYS in src/lib/server/tokens.ts (server-only module)
const SCOPES = ["read", "write", "agent"] as const;
const EXPIRY = ["30", "90", "365", "never"] as const;

// Settings → API tokens (vb_...). Server routes in src/app/api/tokens; the plain token is shown once, right after creation.
export function ApiTokens() {
    const { t } = useLanguage();
    const { toast } = useToast();
    const [tokens, setTokens] = useState<ApiToken[]>([]);
    const [name, setName] = useState("");
    const [created, setCreated] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [scopes, setScopes] = useState<string[]>(["read", "write"]);
    const [expiry, setExpiry] = useState<string>("90");

    const call = async (url: string, init?: RequestInit) => {
        const res = await fetch(url, { ...init, headers: { "content-type": "application/json" } });
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
    };
    const fail = () => toast({ title: t("settings.api_tokens_error"), variant: "destructive" });

    useEffect(() => {
        call("/api/tokens").then((r) => setTokens(r.tokens)).catch(fail);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const create = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        try {
            const expiresInDays = expiry === "never" ? null : Number(expiry);
            const r = await call("/api/tokens", { method: "POST", body: JSON.stringify({ name: name.trim(), scopes, expiresInDays }) });
            setCreated(r.token);
            setName("");
            setTokens((prev) => [{ id: r.id, name: r.name, createdAt: r.createdAt, lastUsedAt: null, expiresAt: r.expiresAt, scopes: r.scopes }, ...prev]);
        } catch {
            fail();
        } finally {
            setBusy(false);
        }
    };

    const revoke = async (token: ApiToken) => {
        if (!window.confirm(t("settings.api_tokens_revoke_confirm"))) return;
        try {
            await call(`/api/tokens/${token.id}`, { method: "DELETE" });
            setTokens((prev) => prev.filter((x) => x.id !== token.id));
        } catch {
            fail();
        }
    };

    const copy = async () => {
        if (!created) return;
        await navigator.clipboard.writeText(created);
        toast({ title: t("settings.api_tokens_copied") });
    };

    const when = (d: string | null) => (d ? new Date(d).toLocaleString() : t("settings.api_tokens_never"));
    const expired = (d: string | null) => !!d && Date.parse(d) <= Date.now();
    const toggleScope = (s: string, on: boolean) => setScopes((prev) => (on ? [...prev, s] : prev.filter((x) => x !== s)));

    return (
        <section className="mt-6 p-4 bg-card rounded-xl border border-border">
            <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-foreground">{t("settings.api_tokens")}</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{t("settings.api_tokens_desc")}</p>

            <form onSubmit={create} className="mt-3 space-y-3">
                <div className="flex gap-2">
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={100}
                        placeholder={t("settings.api_tokens_name")}
                        aria-label={t("settings.api_tokens_name")}
                    />
                    <Button type="submit" size="sm" disabled={busy || !name.trim() || !scopes.length}>
                        {t("settings.api_tokens_create")}
                    </Button>
                </div>
                <fieldset className="space-y-1.5">
                    <legend className="text-xs font-medium text-foreground">{t("settings.api_tokens_scopes")}</legend>
                    {SCOPES.map((s) => (
                        <div key={s} className="flex items-start gap-2">
                            <Checkbox
                                id={"token-scope-" + s}
                                checked={scopes.includes(s)}
                                onCheckedChange={(v) => toggleScope(s, v === true)}
                                className="mt-0.5 h-4 w-4"
                            />
                            <Label htmlFor={"token-scope-" + s} className="text-xs font-normal text-muted-foreground">
                                <span className="font-mono text-foreground">{s}</span>: {t("settings.api_tokens_scope_" + s)}
                            </Label>
                        </div>
                    ))}
                </fieldset>
                <div className="flex items-center gap-2">
                    <Label htmlFor="token-expiry" className="text-xs">{t("settings.api_tokens_expiry")}</Label>
                    <Select value={expiry} onValueChange={setExpiry}>
                        <SelectTrigger id="token-expiry" className="h-8 w-40 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {EXPIRY.map((e) => (
                                <SelectItem key={e} value={e}>{t("settings.api_tokens_expiry_" + e)}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </form>

            {created && (
                <div className="mt-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                    <p className="text-xs text-foreground">{t("settings.api_tokens_once")}</p>
                    <div className="mt-2 flex items-center gap-2">
                        <code className="flex-1 min-w-0 truncate text-xs font-mono bg-muted px-2 py-1 rounded">{created}</code>
                        <Button type="button" size="sm" variant="outline" onClick={copy} aria-label={t("settings.api_tokens_copy")}>
                            <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setCreated(null)}>
                            {t("settings.api_tokens_done")}
                        </Button>
                    </div>
                </div>
            )}

            {tokens.length === 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">{t("settings.api_tokens_empty")}</p>
            ) : (
                <ul className="mt-3 divide-y divide-border">
                    {tokens.map((token) => (
                        <li key={token.id} className="py-2 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-foreground truncate">{token.name}</p>
                                <p className="text-xs text-muted-foreground">
                                    <span className="font-mono">{(token.scopes ?? []).join(", ")}</span> · {t("settings.api_tokens_created")}: {when(token.createdAt)} ·{" "}
                                    {t("settings.api_tokens_last_used")}: {when(token.lastUsedAt)} · {t("settings.api_tokens_expiry")}:{" "}
                                    {expired(token.expiresAt) ? t("settings.api_tokens_expired") : when(token.expiresAt)}
                                </p>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => revoke(token)}
                                aria-label={`${t("settings.api_tokens_revoke")} ${token.name}`}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
