import { Check, Snowflake } from "lucide-react";
import type { DayStatus } from "@/lib/data/dashboard";
import { cn } from "@/lib/utils";

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "narrow", timeZone: "UTC" });

/** The last seven days: studied ✓, covered by a streak freeze ❄, or missed. */
export function WeekStrip({ days }: { days: { date: Date; status: DayStatus; isToday: boolean }[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {days.map(({ date, status, isToday }) => (
        <div key={date.toISOString()} className="flex flex-col items-center gap-1">
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-full text-[11px]",
              status === "studied" && "bg-streak text-streak-foreground",
              status === "frozen" && "bg-frost/20 text-frost",
              status === "partial" && "border border-dashed border-streak/60",
              status === "none" && "bg-muted-foreground/10",
              status === "today" && "border border-dashed border-muted-foreground/40",
            )}
            title={
              status === "studied"
                ? "Studied"
                : status === "frozen"
                  ? "Streak freeze used"
                  : status === "partial"
                    ? "Started — study 5 minutes to count"
                    : isToday
                      ? "Today"
                      : "Missed"
            }
          >
            {status === "studied" && <Check className="size-3.5" strokeWidth={3} />}
            {status === "frozen" && <Snowflake className="size-3.5" />}
          </span>
          <span className={cn("text-[10px]", isToday ? "font-medium text-foreground" : "text-muted-foreground")}>
            {WEEKDAY.format(date)}
          </span>
        </div>
      ))}
    </div>
  );
}
