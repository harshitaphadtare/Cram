"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { levelForXp } from "@/lib/levels";

const CONFIRM_WORD = "RESET";

/** Settings card to start all progress over, behind a type-to-confirm dialog. */
export function ResetProgress({ xp, streak }: { xp: number; streak: number }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const level = levelForXp(xp);

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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reset progress</CardTitle>
        <CardDescription>
          Level <span className="font-medium text-foreground">{level}</span> ·{" "}
          <span className="font-medium text-foreground">{xp.toLocaleString()}</span> XP ·{" "}
          <span className="font-medium text-foreground">{streak}</span>-day streak
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Start over from zero. Your notes, folders, tasks and quiz history are kept.
        </p>
        <AlertDialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setConfirm("");
          }}
        >
          <AlertDialogTrigger
            render={
              <Button variant="outline" className="shrink-0 gap-1.5 text-destructive hover:text-destructive">
                <RotateCcw className="size-4" />
                Reset
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset all progress?</AlertDialogTitle>
              <AlertDialogDescription>
                This can&apos;t be undone. Everything below goes back to zero:
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Streak and best streak, and streak freezes</li>
              <li>XP and level</li>
              <li>All achievements</li>
              <li>Study stats: goal days, focus time, activity calendar, leaderboard XP</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Kept: your notes, folders, tasks, roadmaps and quiz history.
            </p>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-reset" className="font-normal">
                Type <span className="font-semibold">{CONFIRM_WORD}</span> to confirm
              </Label>
              <Input
                id="confirm-reset"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="off"
                autoFocus
              />
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
      </CardContent>
    </Card>
  );
}
