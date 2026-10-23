import { after, NextResponse } from "next/server";
import { fail, serviceClient, type ServiceClient } from "@/lib/server/integration";
import {
    aiCard,
    cardProject,
    dedupKey,
    DEFAULT_AI_MODEL,
    fallbackCard,
    isDuplicate,
    originFooter,
    overRateLimit,
    parseList,
    parseMessage,
    routeMessage,
    runCardJob,
    verifySignature,
    type WaMessage,
} from "@/lib/server/whatsapp";

// WA-AKG gateway webhook. A message in an allowed group becomes a Kanban task in 'ideas'; an owner message starting
// with "Jarvis" goes to jarvis_inbox (read by Jarvis via GET /api/v1/jarvis/inbox). Message text is untrusted: it only
// ever lands in text columns (title/description/inbox text), rendered as plain text.
export async function POST(req: Request) {
    const secret = process.env.WHATSAPP_WEBHOOK_SECRET;
    if (!secret) return fail("whatsapp webhook not configured", 503); // fail closed

    const raw = Buffer.from(await req.arrayBuffer());
    if (!verifySignature(raw, req.headers.get("x-webhook-signature"), secret)) return fail("invalid signature", 401);
    let body: unknown;
    try {
        body = JSON.parse(raw.toString("utf8"));
    } catch {
        return fail("invalid JSON", 400);
    }

    const msg = parseMessage(body);
    const ownerEmail = process.env.WHATSAPP_OWNER_EMAIL?.trim().toLowerCase();
    const route = routeMessage(msg, {
        groups: parseList(process.env.WHATSAPP_GROUP_JIDS),
        owners: ownerEmail ? parseList(process.env.WHATSAPP_OWNER_JIDS) : [], // no owner email = inbox off
    });
    if (route.kind === "ignored") return NextResponse.json({ ignored: route.reason });
    const orgId = process.env.WHATSAPP_ORG_ID;
    if (route.kind === "card" && !orgId) return fail("WHATSAPP_ORG_ID not configured", 503);

    const supabase = serviceClient();
    const messageId = dedupKey(msg);
    const sender = msg.participant ?? msg.remoteJid ?? "";
    const since = (ms: number) =>
        supabase
            .from("whatsapp_messages")
            .select("message_id", { count: "exact", head: true })
            .eq("sender_jid", sender)
            .gte("received_at", new Date(Date.now() - ms).toISOString());
    const [minute, day] = await Promise.all([since(60_000), since(86_400_000)]);
    if (minute.error || day.error) return fail((minute.error ?? day.error)!.message, 500);
    // shortcut: count-then-insert, a burst of parallel deliveries can overshoot by a few; fine for abuse control
    if (overRateLimit(minute.count ?? 0, day.count ?? 0)) return NextResponse.json({ ignored: "rate" });

    const { error } = await supabase
        .from("whatsapp_messages")
        .insert({ message_id: messageId, sender_jid: sender, chat_jid: msg.remoteJid ?? null });
    if (isDuplicate(error)) return NextResponse.json({ duplicate: true });
    if (error) return fail(error.message, 500);
    const release = async () => {
        const { error: e } = await supabase.from("whatsapp_messages").delete().eq("message_id", messageId);
        if (e) throw new Error(e.message);
    };

    if (route.kind === "inbox") {
        const { error: inboxError } = await supabase.from("jarvis_inbox").insert({
            message_id: messageId,
            owner_email: ownerEmail,
            chat_jid: msg.remoteJid ?? null,
            sender_jid: msg.participant ?? null,
            text: route.text,
        });
        if (inboxError) {
            await release().catch((e) => console.error("whatsapp webhook: could not release dedup row", e));
            return fail(inboxError.message, 500);
        }
        return NextResponse.json({ ok: true, inbox: true });
    }

    // Respond within the gateway's 10 s timeout; the card (maybe with an AI call) is created after the response
    after(() =>
        runCardJob(() => createCard(supabase, orgId!, msg), {
            link: async (taskId) => {
                const { error: e } = await supabase.from("whatsapp_messages").update({ task_id: taskId }).eq("message_id", messageId);
                if (e) throw new Error(e.message);
            },
            release,
        })
    );
    return NextResponse.json({ ok: true });
}

async function createCard(supabase: ServiceClient, orgId: string, msg: WaMessage): Promise<string> {
    const { data: projects, error: projectsError } = await supabase.from("projects").select("id, name").eq("organization_id", orgId);
    if (projectsError) throw new Error(projectsError.message);

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const draft =
        (apiKey && msg.text && (await aiCard(msg.text, projects ?? [], apiKey, process.env.WHATSAPP_AI_MODEL || DEFAULT_AI_MODEL))) ||
        fallbackCard(msg.text);
    const description = [draft.description.trim(), originFooter(msg)].filter(Boolean).join("\n\n");

    const { data, error } = await supabase
        .from("tasks")
        .insert({
            organization_id: orgId,
            project_id: cardProject(draft, process.env.WHATSAPP_DEFAULT_PROJECT_ID, (projects ?? []).map((p) => p.id)),
            title: draft.title,
            description,
            status: "ideas",
            priority: draft.priority,
            code: `TASK-${Math.floor(Math.random() * 10000)}`, // same scheme as createTask in src/lib/api.ts
        })
        .select("id")
        .single();
    if (error) throw new Error(`${error.code ?? ""} ${error.message}`);
    return data.id;
}
