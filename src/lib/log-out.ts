"use client";

import { signOut } from "@/app/actions/auth";

/** Client-side logout: clears per-browser state that shouldn't outlive the session, then signs out. */
export function logOut() {
  try {
    // Open tabs are per-browser; don't leak them to whoever logs in next.
    window.localStorage.removeItem("cram.tabs");
  } catch {
    // Storage unavailable — nothing to clear.
  }
  void signOut();
}
