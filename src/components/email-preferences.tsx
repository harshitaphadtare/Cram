"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { updateEmailPreference } from "@/app/actions/email";

type Prefs = { emailReminders: boolean; emailPlan: boolean; emailWeekly: boolean };

const ROWS: { key: keyof Prefs; title: string; description: string }[] = [
  {
    key: "emailReminders",
    title: "Streak reminders",
    description: "At 8 pm if your streak is about to end, and a nudge if you've been away a few days.",
  },
  {
    key: "emailPlan",
    title: "Morning plan",
    description: "At 8 am when pages are ready for review or tasks are due.",
  },
  {
    key: "emailWeekly",
    title: "Weekly recap",
    description: "Sunday evening: your study time, XP and achievements for the week.",
  },
];

export function EmailPreferences(initial: Prefs) {
  const [prefs, setPrefs] = useState(initial);
  const [pending, startTransition] = useTransition();

  function toggle(key: keyof Prefs, on: boolean) {
    setPrefs((p) => ({ ...p, [key]: on }));
    startTransition(async () => {
      try {
        await updateEmailPreference(key, on);
      } catch {
        setPrefs((p) => ({ ...p, [key]: !on }));
        toast.error("Couldn't update that setting.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Email notifications</CardTitle>
        <CardDescription>Sent at these times in your timezone, and only when there&apos;s a reason to.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {ROWS.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-6">
            <div>
              <Label htmlFor={row.key} className="font-normal">{row.title}</Label>
              <p className="text-xs text-muted-foreground">{row.description}</p>
            </div>
            <Switch
              id={row.key}
              checked={prefs[row.key]}
              onCheckedChange={(on) => toggle(row.key, on)}
              disabled={pending}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
