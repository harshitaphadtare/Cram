import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFolderRole, roleAtLeast } from "@/lib/permissions";
import { FolderRole } from "@/generated/prisma/enums";
import { synthesizeSpeech, TTS_MODEL } from "@/lib/tts";
import { DEFAULT_TTS_VOICE, isTtsVoice } from "@/lib/tts-voices";

// Generating a minute of speech can take a while.
export const maxDuration = 60;

const BUCKET = "page-speech";
const MAX_TEXT_CHARS = 1500;

function storage() {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    .storage;
}

/** Creates the public audio bucket on first use. */
async function ensureBucket(store: ReturnType<typeof storage>) {
  const { error } = await store.getBucket(BUCKET);
  if (!error) return;
  const created = await store.createBucket(BUCKET, { public: true, allowedMimeTypes: ["audio/wav"] });
  if (created.error && !/already exists/i.test(created.error.message)) throw created.error;
}

/**
 * Returns a URL to a spoken version of a chunk of a page's notes. Clips are cached by a hash of
 * the text + voice, so replaying (or anyone reading the same notes) costs nothing and is instant.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    pageId?: unknown;
    text?: unknown;
    voice?: unknown;
  } | null;
  const voice = isTtsVoice(body?.voice) ? body.voice : DEFAULT_TTS_VOICE;
  const pageId = typeof body?.pageId === "string" ? body.pageId : null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!pageId || !text) return NextResponse.json({ error: "Missing page or text." }, { status: 400 });
  if (text.length > MAX_TEXT_CHARS) return NextResponse.json({ error: "That section is too long." }, { status: 400 });

  // Only people who can read the page can have it read to them.
  const page = await prisma.page.findUnique({ where: { id: pageId }, select: { folderId: true } });
  if (!page || !roleAtLeast(await getFolderRole(page.folderId, user.id), FolderRole.VIEWER)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const hash = createHash("sha256").update(`${TTS_MODEL}|${voice}|${text}`).digest("hex");
  const path = `${hash}.wav`;
  const store = storage();
  const publicUrl = store.from(BUCKET).getPublicUrl(path).data.publicUrl;

  const cached = await fetch(publicUrl, { method: "HEAD" }).catch(() => null);
  if (cached?.ok) return NextResponse.json({ url: publicUrl });

  let wav: Buffer;
  try {
    wav = await synthesizeSpeech(text, voice);
  } catch (err) {
    console.error("Speech synthesis failed", err);
    const busy = err instanceof Error && /429|quota|503|overloaded/i.test(err.message);
    return NextResponse.json(
      { error: busy ? "The voice is busy right now — try again in a minute." : "Couldn't generate audio." },
      { status: busy ? 429 : 502 },
    );
  }

  try {
    await ensureBucket(store);
    const { error } = await store.from(BUCKET).upload(path, wav, { contentType: "audio/wav", upsert: true });
    if (error) throw error;
  } catch (err) {
    console.error("Couldn't cache speech clip", err);
    // Still play it, just uncached: hand the audio back inline.
    return new NextResponse(new Uint8Array(wav), { headers: { "Content-Type": "audio/wav" } });
  }

  return NextResponse.json({ url: publicUrl });
}
