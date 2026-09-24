import { cn } from "@/lib/utils";

/** "45m", "1h", "1h 5m": compact enough to sit inside a small ring. */
function compactMinutes(m: number) {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

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
      {/* Label scales with the ring so it stays centred and proportional at any size. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="leading-none font-semibold tabular-nums" style={{ fontSize: Math.round(size * 0.19) }}>
          {compactMinutes(minutes)}
        </span>
        <span className="mt-[0.35em] leading-none text-muted-foreground" style={{ fontSize: Math.max(9, Math.round(size * 0.105)) }}>
          of {compactMinutes(goal)}
        </span>
      </div>
    </div>
  );
}
