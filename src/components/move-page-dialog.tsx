"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, CornerDownRight, FileText, FolderOpen, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { movePage } from "@/app/actions/pages";
import { buildPageTree, flattenPageTree, pageDescendantIds } from "@/lib/page-tree";
import { cn } from "@/lib/utils";

interface FolderPage {
  id: string;
  title: string;
  parentId: string | null;
}

/**
 * "Move to…": nest a page (and everything inside it) under another page of the same subject, or
 * move it back to the subject's top level. The page itself and its own sub-pages aren't offered.
 */
export function MovePageDialog({
  open,
  onOpenChange,
  pageId,
  folderName,
  pages,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageId: string;
  folderName: string;
  pages: FolderPage[];
}) {
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const current = pages.find((p) => p.id === pageId);

  const targets = useMemo(() => {
    const blocked = new Set([pageId, ...pageDescendantIds(pageId, pages)]);
    return flattenPageTree(buildPageTree(pages)).filter((n) => !blocked.has(n.page.id));
  }, [pageId, pages]);

  const q = query.trim().toLowerCase();
  const shown = q ? targets.filter((n) => (n.page.title || "untitled").toLowerCase().includes(q)) : targets;

  function moveTo(parentId: string | null) {
    if (parentId === (current?.parentId ?? null)) return onOpenChange(false);
    startTransition(async () => {
      try {
        await movePage(pageId, parentId);
        const where = parentId ? pages.find((p) => p.id === parentId)?.title || "Untitled" : folderName;
        toast.success(`Moved to ${where}`);
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't move the page.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
    >
      <DialogContent className="gap-3 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move &ldquo;{current?.title || "Untitled"}&rdquo;</DialogTitle>
          <DialogDescription>Put it inside another page, or back at the top of {folderName}.</DialogDescription>
        </DialogHeader>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pages…" autoFocus />
        <div className="-mx-1 flex max-h-80 flex-col gap-0.5 overflow-y-auto px-1">
          {!q && (
            <TargetRow
              label={`Top of ${folderName}`}
              icon={<FolderOpen className="size-4" />}
              depth={0}
              selected={!current?.parentId}
              disabled={pending}
              onPick={() => moveTo(null)}
            />
          )}
          {shown.map((n) => (
            <TargetRow
              key={n.page.id}
              label={n.page.title || "Untitled"}
              icon={q || n.depth === 0 ? <FileText className="size-4" /> : <CornerDownRight className="size-3.5" />}
              depth={q ? 0 : n.depth + 1}
              selected={current?.parentId === n.page.id}
              disabled={pending}
              onPick={() => moveTo(n.page.id)}
            />
          ))}
          {shown.length === 0 && q && <p className="px-2 py-6 text-center text-sm text-muted-foreground">No matching pages</p>}
        </div>
        {pending && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Moving…
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TargetRow({
  label,
  icon,
  depth,
  selected,
  disabled,
  onPick,
}: {
  label: string;
  icon: React.ReactNode;
  depth: number;
  selected: boolean;
  disabled: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      style={{ paddingLeft: 8 + depth * 16 }}
      className={cn(
        "flex items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm transition-colors hover:bg-accent disabled:opacity-60",
        selected && "bg-accent/60",
      )}
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {selected && <Check className="size-4 shrink-0 text-primary" aria-label="Current location" />}
    </button>
  );
}
