import { Brain, Crown, Flame, PenLine, Sprout, Star, Target, Timer, Trophy, type LucideIcon } from "lucide-react";
import type { AchievementIcon } from "@/lib/achievements";
import { cn } from "@/lib/utils";

const ICONS: Record<AchievementIcon, LucideIcon> = {
  sprout: Sprout,
  flame: Flame,
  timer: Timer,
  brain: Brain,
  target: Target,
  pen: PenLine,
  star: Star,
  trophy: Trophy,
  crown: Crown,
};

/** Round medallion: gold when unlocked, a quiet outline when still locked. */
export function AchievementBadge({
  icon,
  unlocked,
  size = "md",
}: {
  icon: AchievementIcon;
  unlocked: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const Icon = ICONS[icon];
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        size === "sm" && "size-8 [&_svg]:size-4",
        size === "md" && "size-10 [&_svg]:size-5",
        size === "lg" && "size-14 [&_svg]:size-7",
        unlocked
          ? "bg-gold/15 text-gold ring-1 ring-gold/40"
          : "bg-muted text-muted-foreground/60 ring-1 ring-border",
      )}
    >
      <Icon strokeWidth={2} />
    </span>
  );
}
