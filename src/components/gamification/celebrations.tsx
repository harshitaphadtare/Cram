"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { ACHIEVEMENTS, LEVEL_KEY_PREFIX } from "@/lib/achievements";
import { titleForLevel } from "@/lib/levels";
import { fireConfetti } from "@/lib/confetti";
import { markCelebrationsSeen } from "@/app/actions/gamification";
import { X } from "lucide-react";
import { AchievementBadge } from "@/components/gamification/achievement-badge";
import type { AchievementIcon } from "@/lib/achievements";

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
          toast.custom(
            (id) => (
              <CelebrationToast
                id={id}
                icon="trophy"
                eyebrow="Level up"
                title={`Level ${level} reached!`}
                description={`You're now a ${titleForLevel(level)}. Keep it up.`}
              />
            ),
            { duration: 6000 },
          );
          return;
        }
        const def = ACHIEVEMENTS.find((a) => a.key === item.key);
        if (!def) return;
        toast.custom(
          (id) => (
            <CelebrationToast
              id={id}
              icon={def.icon}
              eyebrow="Achievement unlocked"
              title={def.title}
              description={def.description}
            />
          ),
          { duration: 6000 },
        );
      }, index * 400);
    });

    void markCelebrationsSeen(fresh.map((i) => i.id));
  }, [items]);

  return null;
}

/** Achievement / level-up card. Custom-rendered because Sonner's icon slot is too small for the
 * medallion, which then overlapped the title. */
function CelebrationToast({
  id,
  icon,
  eyebrow,
  title,
  description,
}: {
  id: string | number;
  icon: AchievementIcon;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="group relative flex w-[356px] max-w-[calc(100vw-2rem)] items-center gap-3.5 overflow-hidden rounded-xl border bg-popover p-3.5 pr-9 text-popover-foreground shadow-lg">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-gold/10 to-transparent" />
      <span className="relative">
        <AchievementBadge icon={icon} unlocked size="md" />
      </span>
      <div className="relative flex min-w-0 flex-col gap-0.5">
        <span className="text-[11px] font-semibold tracking-wide text-gold uppercase">{eyebrow}</span>
        <span className="truncate text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <button
        type="button"
        onClick={() => toast.dismiss(id)}
        aria-label="Dismiss"
        className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
