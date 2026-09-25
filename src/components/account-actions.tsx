"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { resetProgress } from "@/app/actions/gamification";
import { logOut } from "@/lib/log-out";

const CONFIRM_WORD = "RESET";

/** One row of the account card: title and description on the left, action on the right. */
function ActionRow({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ResetProgressButton() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();

  function handleReset() {
    startTransition(async () => {
      try {
        await resetProgress();
        setOpen(false);
        setConfirm("");
        toast.success("Progress reset. Fresh start!");
      } catch {
        toast.error("Couldn't reset your progress.");
      }
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setConfirm("");
      }}
    >
      <AlertDialogTrigger
        render={
          <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
            Reset
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset all progress?</AlertDialogTitle>
          <AlertDialogDescription>
            Your streak, XP, level, achievements and study stats go back to zero. Notes, folders,
            tasks and quiz history are kept. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-reset" className="font-normal">
            Type <span className="font-semibold">{CONFIRM_WORD}</span> to confirm
          </Label>
          <Input id="confirm-reset" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" autoFocus />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            onClick={handleReset}
            disabled={pending || confirm.trim() !== CONFIRM_WORD}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            Reset progress
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Last card on the settings page: log out, and reset progress. */
export function AccountActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Account</CardTitle>
      </CardHeader>
      <CardContent className="divide-y">
        <ActionRow title="Log out" description="Sign out of Cram on this device.">
          <Button variant="outline" onClick={logOut}>
            Log out
          </Button>
        </ActionRow>
        <ActionRow
          title="Reset progress"
          description="Start your streak, XP, level and achievements over. Your notes are kept."
        >
          <ResetProgressButton />
        </ActionRow>
      </CardContent>
    </Card>
  );
}
