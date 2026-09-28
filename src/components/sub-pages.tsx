"use client";

import Link from "next/link";
import { FileText } from "lucide-react";

/**
 * A page's sub-pages, shown Notion-style as compact page links flowing on from the content
 * (icon + title with a soft underline). New sub-pages are added from "Add sub-page" under the
 * title.
 */
export function SubPages({
  folderId,
  subPages,
}: {
  folderId: string;
  subPages: { id: string; title: string; childCount: number }[];
}) {
  if (subPages.length === 0) return null;

  return (
    <nav aria-label="Pages inside this page" className="-mx-1.5 flex flex-col">
      {subPages.map((p) => (
        <Link
          key={p.id}
          href={`/app/folders/${folderId}/pages/${p.id}`}
          className="group flex w-fit max-w-full items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-muted"
          title={p.childCount > 0 ? `${p.childCount} ${p.childCount === 1 ? "page" : "pages"} inside` : undefined}
        >
          <FileText className="size-[1.125rem] shrink-0 text-muted-foreground" strokeWidth={1.75} />
          <span className="truncate font-medium underline decoration-foreground/25 decoration-1 underline-offset-[5px] transition-colors group-hover:decoration-foreground/60">
            {p.title || "Untitled"}
          </span>
        </Link>
      ))}
    </nav>
  );
}
