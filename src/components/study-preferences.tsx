"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DAILY_GOAL_OPTIONS } from "@/lib/goals";
import { updateDailyGoal, updateLeaderboardVisibility } from "@/app/actions/gamification";
import { cn } from "@/lib/utils";

const GOAL_HINTS: Record<number, string> = {
  10: "Casual",
  20: "Regular",
  30: "Serious",
  45: "Intense",
  60: "Exam mode",
  90: "All in",
};

export function StudyPreferences({
  dailyGoalMin,
  showOnLeaderboard,
}: {
  dailyGoalMin: number;
  showOnLeaderboard: boolean;
}) {
  const [goal, setGoal] = useState(dailyGoalMin);
  const [leaderboard, setLeaderboard] = useState(showOnLeaderboard);
  const [pending, startTransition] = useTransition();

  function pickGoal(minutes: number) {
    const previous = goal;
    setGoal(minutes);
    startTransition(async () => {
      try {
        await updateDailyGoal(minutes);
        toast.success(`Daily goal set to ${minutes} minutes`);
      } catch (err) {
        setGoal(previous);
        toast.error(err instanceof Error ? err.message : "Couldn't update your goal.");
      }
    });
  }

  function toggleLeaderboard(show: boolean) {
    setLeaderboard(show);
    startTransition(async () => {
      try {
        await updateLeaderboardVisibility(show);
      } catch {
        setLeaderboard(!show);
        toast.error("Couldn't update that setting.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Study goals</CardTitle>
        <CardDescription>
          Focus sessions and time spent writing notes both count toward your daily goal.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-3 gap-2">
          {DAILY_GOAL_OPTIONS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              disabled={pending}
              onClick={() => pickGoal(minutes)}
              aria-pressed={goal === minutes}
              className={cn(
                "flex flex-col items-start rounded-lg border px-3 py-2.5 text-left transition-colors",
                goal === minutes
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "hover:bg-accent",
              )}
            >
              <span className="text-sm font-medium">{minutes} min</span>
              <span className="text-xs text-muted-foreground">{GOAL_HINTS[minutes]}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="font-normal">Show me on leaderboards</Label>
            <p className="text-xs text-muted-foreground">
              Lets people you share folders with see your weekly XP.
            </p>
          </div>
          <Switch checked={leaderboard} onCheckedChange={toggleLeaderboard} disabled={pending} />
        </div>
      </CardContent>
    </Card>
  );
}
