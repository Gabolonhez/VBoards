import { NextResponse } from "next/server";
import { fail, v1Context } from "@/lib/server/integration";

// Owner WhatsApp messages addressed to "Jarvis" (written by /api/whatsapp/webhook), oldest first, until acked.
export async function GET(req: Request) {
    const ctx = await v1Context(req, "agent", true);
    if (ctx instanceof Response) return ctx;

    const { data, error } = await ctx.supabase
        .from("jarvis_inbox")
        .select("id, chat_jid, sender_jid, text, received_at, audio_mime, audio_bytes")
        .eq("owner_email", ctx.email)
        .is("acked_at", null)
        .order("received_at", { ascending: true })
        .limit(20);
    if (error) return fail(error.message, 500);
    return NextResponse.json({
        messages: (data ?? []).map((m) => ({ id: m.id, chatJid: m.chat_jid, senderJid: m.sender_jid, text: m.text, receivedAt: m.received_at, ...(m.audio_mime ? { audio: { mime: m.audio_mime, bytes: m.audio_bytes ?? 0 } } : {}) })),
    });
}
