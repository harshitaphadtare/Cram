"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { adoptBrowserTimezone } from "@/app/actions/profile";

/** Saves the browser's timezone once for users still on the "UTC" default. */
export function TimezoneSync({ current }: { current: string }) {
  const router = useRouter();

  useEffect(() => {
    if (current !== "UTC") return;
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browserTz || browserTz === "UTC") return;
    adoptBrowserTimezone(browserTz)
      .then(() => router.refresh())
      .catch(() => {});
  }, [current, router]);

  return null;
}
