import { cn } from "@/lib/utils";
import { formatGoal } from "@/lib/goals";

/** Apple-Activity-style ring: fills as today's study minutes approach the daily goal. */
export function GoalRing({
  minutes,
  goal,
  size = 96,
  stroke = 9,
  className,
}: {
  minutes: number;
  goal: number;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const progress = Math.min(1, goal > 0 ? minutes / goal : 0);
  const done = minutes >= goal;

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-muted-foreground/15" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - progress)}
          style={{ "--ring-circumference": c } as React.CSSProperties}
          className={cn(
            "cram-ring-fill transition-[stroke-dashoffset] duration-700 ease-out",
            done ? "stroke-chart-3" : "stroke-primary",
          )}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-xl font-semibold tabular-nums">{minutes}</span>
        <span className="mt-1 text-[11px] text-muted-foreground">of {formatGoal(goal)}</span>
      </div>
    </div>
  );
}
