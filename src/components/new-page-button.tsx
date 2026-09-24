"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPage } from "@/app/actions/pages";

export function NewPageButton({ folderId }: { folderId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      try {
        const page = await createPage(folderId);
        router.push(`/app/folders/${folderId}/pages/${page.id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't create the page.");
      }
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={pending} className="gap-1.5">
      {pending ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
      New page
    </Button>
  );
}
