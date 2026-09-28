"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deletePage } from "@/app/actions/pages";

export function DeletePageButton({
  pageId,
  title,
  subPageCount = 0,
}: {
  pageId: string;
  title: string;
  /** Pages nested inside this one — deleted along with it. */
  subPageCount?: number;
}) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      try {
        await deletePage(pageId);
        toast.success(`Deleted "${title}"`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't delete the page.");
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Delete ${title}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        }
      />
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{title}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            {subPageCount > 0
              ? `This permanently deletes the page, the ${subPageCount} ${subPageCount === 1 ? "page" : "pages"} inside it, and any quizzes generated from them. This can't be undone.`
              : "This permanently deletes the page and any quizzes generated from it. This can't be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={pending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
