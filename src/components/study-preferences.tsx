"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DAILY_GOAL_OPTIONS, MAX_GOAL_MIN, MIN_GOAL_MIN, formatGoal } from "@/lib/goals";
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

const isPreset = (m: number) => (DAILY_GOAL_OPTIONS as readonly number[]).includes(m);

export function StudyPreferences({
  dailyGoalMin,
  showOnLeaderboard,
}: {
  dailyGoalMin: number;
  showOnLeaderboard: boolean;
}) {
  const [goal, setGoal] = useState(dailyGoalMin);
  const [customOpen, setCustomOpen] = useState(!isPreset(dailyGoalMin));
  // Custom goal is entered as hours + minutes, which reads more naturally than "240 minutes".
  const [hours, setHours] = useState(String(Math.floor(dailyGoalMin / 60)));
  const [minutes, setMinutes] = useState(String(dailyGoalMin % 60));
  const [leaderboard, setLeaderboard] = useState(showOnLeaderboard);
  const [pending, startTransition] = useTransition();

  const customTotal = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
  const customValid = Number.isInteger(customTotal) && customTotal >= MIN_GOAL_MIN && customTotal <= MAX_GOAL_MIN;

  function saveGoal(value: number) {
    const previous = goal;
    setGoal(value);
    startTransition(async () => {
      try {
        await updateDailyGoal(value);
        toast.success(`Daily goal set to ${formatGoal(value)}`);
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

  const customSelected = !isPreset(goal);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Study goals</CardTitle>
        <CardDescription>
          Focus sessions and time spent writing notes both count toward your daily goal.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
            {DAILY_GOAL_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                disabled={pending}
                onClick={() => {
                  setCustomOpen(false);
                  saveGoal(m);
                }}
                aria-pressed={goal === m}
                className={cn(
                  "flex flex-col items-start rounded-lg border px-3 py-2.5 text-left transition-colors",
                  goal === m ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent",
                )}
              >
                <span className="text-sm font-medium">{m} min</span>
                <span className="text-xs text-muted-foreground">{GOAL_HINTS[m]}</span>
              </button>
            ))}
          </div>

          <div
            className={cn(
              "rounded-lg border transition-colors",
              customSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : customOpen && "bg-accent/40",
            )}
          >
            <button
              type="button"
              onClick={() => setCustomOpen((o) => !o)}
              aria-expanded={customOpen}
              className="flex w-full items-center justify-between px-3 py-2.5 text-left"
            >
              <span className="flex flex-col">
                <span className="text-sm font-medium">
                  {customSelected ? formatGoal(goal) : "Custom"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {customSelected ? "Your own goal" : "Set any goal, up to 12 hours"}
                </span>
              </span>
              <span className="text-xs text-muted-foreground">{customOpen ? "Close" : "Set"}</span>
            </button>

            {customOpen && (
              <form
                className="flex flex-wrap items-end gap-2 border-t px-3 py-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (customValid) saveGoal(customTotal);
                }}
              >
                <div className="flex flex-col gap-1">
                  <Label htmlFor="goal-hours" className="text-xs text-muted-foreground">Hours</Label>
                  <Input
                    id="goal-hours"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={12}
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    className="w-20"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="goal-minutes" className="text-xs text-muted-foreground">Minutes</Label>
                  <Input
                    id="goal-minutes"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={59}
                    step={5}
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    className="w-20"
                  />
                </div>
                <Button type="submit" disabled={pending || !customValid || customTotal === goal}>
                  Save goal
                </Button>
                <p className={cn("w-full text-xs", customValid ? "text-muted-foreground" : "text-destructive")}>
                  {customValid
                    ? `That's ${formatGoal(customTotal)} a day.`
                    : `Choose between ${MIN_GOAL_MIN} minutes and ${MAX_GOAL_MIN / 60} hours.`}
                </p>
              </form>
            )}
          </div>
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
