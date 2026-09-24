"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { ACHIEVEMENTS, LEVEL_KEY_PREFIX } from "@/lib/achievements";
import { titleForLevel } from "@/lib/levels";
import { fireConfetti } from "@/lib/confetti";
import { markCelebrationsSeen } from "@/app/actions/gamification";
import { AchievementBadge } from "@/components/gamification/achievement-badge";

export interface Celebration {
  id: string;
  key: string;
}

/**
 * Shows unseen level-ups and achievement unlocks (queued server-side in UserAchievement) as
 * celebratory toasts with confetti, then marks them seen. Rendered once in the app layout, so it
 * fires on the next render after whatever action earned them.
 */
export function Celebrations({ items }: { items: Celebration[] }) {
  const shown = useRef(new Set<string>());

  useEffect(() => {
    const fresh = items.filter((i) => !shown.current.has(i.id));
    if (fresh.length === 0) return;
    fresh.forEach((i) => shown.current.add(i.id));

    fireConfetti();
    fresh.forEach((item, index) => {
      setTimeout(() => {
        if (item.key.startsWith(LEVEL_KEY_PREFIX)) {
          const level = Number(item.key.slice(LEVEL_KEY_PREFIX.length));
          toast(`Level ${level} reached!`, {
            description: `You're now a ${titleForLevel(level)}. Keep it up.`,
            icon: <AchievementBadge icon="trophy" unlocked size="sm" />,
            duration: 6000,
          });
          return;
        }
        const def = ACHIEVEMENTS.find((a) => a.key === item.key);
        if (!def) return;
        toast(`Achievement unlocked: ${def.title}`, {
          description: def.description,
          icon: <AchievementBadge icon={def.icon} unlocked size="sm" />,
          duration: 6000,
        });
      }, index * 400);
    });

    void markCelebrationsSeen(fresh.map((i) => i.id));
  }, [items]);

  return null;
}
