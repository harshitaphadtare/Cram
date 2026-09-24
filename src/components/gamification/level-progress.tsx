import { levelInfo } from "@/lib/levels";
import { cn } from "@/lib/utils";

/** Level number, title and a slim bar toward the next level. */
export function LevelProgress({ xp, className }: { xp: number; className?: string }) {
  const info = levelInfo(xp);
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">
          Level {info.level} <span className="font-normal text-muted-foreground">· {info.title}</span>
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {info.intoLevel} / {info.levelSpan} XP
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted-foreground/15">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
          style={{ width: `${Math.max(2, info.progress * 100)}%` }}
        />
      </div>
    </div>
  );
}
