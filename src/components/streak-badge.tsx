"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Flame } from "lucide-react";
import { getStreakCount } from "@/app/actions/gamification";
import { cn } from "@/lib/utils";

export function StreakBadge({
  count: initialCount,
  className,
}: {
  count: number;
  className?: string;
}) {
  const pathname = usePathname();
  const [count, setCount] = useState(initialCount);
  const [lastInitial, setLastInitial] = useState(initialCount);
  if (initialCount !== lastInitial) {
    // The layout re-rendered (e.g. after an action revalidated it) with a fresh count.
    setLastInitial(initialCount);
    setCount(initialCount);
  }

  // The layout keeps this badge mounted across navigations, so its server-rendered count goes
  // stale (e.g. a streak that broke overnight). Re-check whenever the page changes.
  useEffect(() => {
    let cancelled = false;
    getStreakCount()
      .then((n) => !cancelled && setCount(n))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

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
