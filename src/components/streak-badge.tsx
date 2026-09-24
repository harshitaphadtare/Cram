import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export function StreakBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  const active = count > 0;
  return (
    <div
      className={cn(
        "flex h-7 items-center gap-1.5 rounded-md px-2 text-sm tabular-nums text-muted-foreground",
        className,
      )}
      title={active ? `${count}-day streak` : "No streak yet — study today to start one!"}
    >
      <Flame
        className={cn("size-4", active ? "fill-streak/25 text-streak" : "text-muted-foreground")}
      />
      <span className={cn(active && "font-medium text-foreground")}>{count}</span>
      <span>{count === 1 ? "day" : "days"}</span>
    </div>
  );
}
