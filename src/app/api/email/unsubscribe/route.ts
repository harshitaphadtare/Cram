import { NextResponse } from "next/server";
import { unsubscribeWithToken } from "@/lib/email/preferences";

/**
 * RFC 8058 one-click unsubscribe: mail apps (Gmail, Apple Mail) POST here when someone presses
 * their built-in "Unsubscribe" button. The signed token in the URL proves which user it's for.
 */
export async function POST(request: Request) {
  const q = new URL(request.url).searchParams;
  const result = await unsubscribeWithToken({ userId: q.get("u"), pref: q.get("p"), token: q.get("t") });
  return NextResponse.json(result.ok ? { ok: true } : { error: "Invalid link" }, { status: result.ok ? 200 : 400 });
}

/** Someone opened the one-click URL in a browser: show the normal unsubscribe page instead. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  url.pathname = "/email/unsubscribe";
  return NextResponse.redirect(url);
}
