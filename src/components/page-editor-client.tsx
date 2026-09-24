"use client";

import dynamic from "next/dynamic";

/**
 * BlockNote touches `window` while rendering, so the editor can't be server-rendered. This
 * client-only wrapper skips SSR and shows a title-shaped placeholder until the editor loads.
 */
export const PageEditorClient = dynamic(
  () => import("@/components/page-editor").then((m) => m.PageEditor),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 pt-10">
        <div className="h-12 w-2/3 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
      </div>
    ),
  },
);
