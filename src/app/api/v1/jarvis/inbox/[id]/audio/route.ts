import { fail, v1Context } from "@/lib/server/integration";
import { isUuid } from "@/lib/server/v1";

const AUDIO_MAX_BYTES = 12 * 1024 * 1024; // same cap as the Habblaud client (AUDIO_MAX_BYTES)
const AUDIO_MIME = /^audio\/[\w.+-]+$/;

// Raw bytes of the voice message attached to one of the caller's inbox items (private storage bucket `jarvis-audio`).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await v1Context(req, "agent", true);
    if (ctx instanceof Response) return ctx;

    const { id } = await params;
    if (!isUuid(id)) return fail("not found", 404);
    const { data, error } = await ctx.supabase
        .from("jarvis_inbox")
        .select("audio_path, audio_mime, audio_bytes")
        .eq("id", id)
        .eq("owner_email", ctx.email)
        .maybeSingle();
    if (error) return fail(error.message, 500);
    if (!data?.audio_path) return fail("not found", 404);
    if ((data.audio_bytes ?? 0) > AUDIO_MAX_BYTES) return fail("audio too large", 413);

    const { data: file, error: dlError } = await ctx.supabase.storage.from("jarvis-audio").download(data.audio_path);
    if (dlError || !file) return fail(dlError?.message ?? "audio missing", 500);
    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > AUDIO_MAX_BYTES) return fail("audio too large", 413);
    return new Response(bytes, {
        headers: {
            "content-type": AUDIO_MIME.test(data.audio_mime ?? "") ? data.audio_mime : "application/octet-stream",
            "content-length": String(bytes.byteLength),
            "cache-control": "private, no-store",
            "x-content-type-options": "nosniff",
        },
    });
}
