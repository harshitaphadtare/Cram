"use client";

import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { loadTimeBreakdown } from "@/app/actions/progress";
import type { TimeBreakdown, TimeEntity, TimeRange } from "@/lib/data/time-breakdown";
import { cn } from "@/lib/utils";

const RANGES: { value: TimeRange; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];
const MAX_BACK = { week: 520, month: 120, year: 10 } as const;
const PLOT_H = 168;

function formatDuration(seconds: number) {
  const min = Math.round(seconds / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** A round axis maximum (in seconds) at or above the tallest column. */
function niceMax(seconds: number) {
  const min = seconds / 60;
  const steps = [30, 60, 90, 120, 180, 240, 300, 360, 480, 600, 720, 900, 1200, 1800, 2400, 3000, 3600];
  for (const s of steps) if (min <= s) return s * 60;
  return Math.ceil(min / 1200) * 1200 * 60;
}

const colorOf = (e: Pick<TimeEntity, "slot" | "kind">) =>
  e.slot ? `var(--viz-${e.slot})` : e.kind === "other" ? "var(--viz-other)" : "var(--viz-unassigned)";

/**
 * Progress → "Where your time went": a stacked column per day (or month) coloured by folder / task,
 * and a ranked list that doubles as the legend and the table view.
 */
export function TimeBreakdownCard({ initial }: { initial: TimeBreakdown }) {
  const [data, setData] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [hover, setHover] = useState<number | null>(null);

  function load(range: TimeRange, offset: number) {
    setHover(null);
    startTransition(async () => {
      try {
        setData(await loadTimeBreakdown(range, offset));
      } catch {
        toast.error("Couldn't load that period.");
      }
    });
  }

  const { range, offset, columns, entities, total } = data;
  const byKey = new Map(entities.map((e) => [e.key, e]));
  const max = niceMax(Math.max(0, ...columns.map((c) => c.total)));
  const topSeconds = Math.max(1, ...entities.map((e) => e.seconds));
  const periodWord = range === "week" ? "week" : range === "month" ? "month" : "year";
  const showLabel = (i: number) => range !== "month" || [0, 7, 14, 21, 28].includes(i);

  return (
    <section className="cram-viz rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <h2 className="text-sm font-medium">Where your time went</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => load(range, offset - 1)}
              disabled={pending || offset <= -MAX_BACK[range]}
              aria-label={`Previous ${periodWord}`}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-28 text-center text-sm tabular-nums">{data.periodLabel}</span>
            <button
              type="button"
              onClick={() => load(range, offset + 1)}
              disabled={pending || offset >= 0}
              aria-label={`Next ${periodWord}`}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <div role="tablist" aria-label="Range" className="flex rounded-lg bg-muted p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                role="tab"
                aria-selected={range === r.value}
                onClick={() => range !== r.value && load(r.value, 0)}
                disabled={pending}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  range === r.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={cn("p-5 transition-opacity", pending && "opacity-60")}>
        {/* Headline */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-3xl font-semibold">{formatDuration(total)}</span>
          <span className="text-sm text-muted-foreground">
            {total > 0
              ? `${data.activeDays} ${data.activeDays === 1 ? "day" : "days"} studied · ${formatDuration(
                  total / Math.max(1, data.activeDays),
                )} on an average study day`
              : `No study time recorded this ${periodWord}`}
          </span>
        </div>

        {/* Chart */}
        <div className="mt-6 flex gap-3">
          {/* Y axis */}
          <div className="relative w-11 shrink-0 text-right text-[0.6875rem] whitespace-nowrap text-muted-foreground" style={{ height: PLOT_H }}>
            {[1, 0.5, 0].map((f) => (
              <span key={f} className="absolute right-0 -translate-y-1/2 tabular-nums" style={{ top: (1 - f) * PLOT_H }}>
                {f === 0 ? "0" : formatDuration(max * f)}
              </span>
            ))}
          </div>

          <div className="relative min-w-0 flex-1">
            {/* Gridlines */}
            <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: PLOT_H }}>
              {[0, 0.5, 1].map((f) => (
                <div key={f} className="absolute inset-x-0 h-px bg-border" style={{ top: f * PLOT_H }} />
              ))}
            </div>

            {/* Columns */}
            <div className="relative flex" style={{ height: PLOT_H }} onMouseLeave={() => setHover(null)}>
              {columns.map((col, i) => {
                const segs = entities.filter((e) => (col.seconds[e.key] ?? 0) > 0);
                return (
                  <div
                    key={i}
                    tabIndex={col.total > 0 ? 0 : -1}
                    aria-label={`${col.fullLabel}: ${col.total > 0 ? formatDuration(col.total) : "no study"}`}
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    className="group relative flex h-full flex-1 cursor-default items-end justify-center outline-none"
                  >
                    {/* Hover band: the whole slot is the hit target, bigger than the bar. */}
                    <div
                      className={cn(
                        "absolute inset-x-px inset-y-0 rounded-md transition-colors",
                        hover === i && col.total > 0 && "bg-muted/60",
                      )}
                    />
                    <div
                      className={cn(
                        "relative flex w-full flex-col-reverse gap-[2px]",
                        range === "month" ? "max-w-3.5" : "max-w-6",
                      )}
                    >
                      {segs.map((e) => (
                        <div
                          key={e.key}
                          className="w-full last:rounded-t-[4px]"
                          style={{
                            height: Math.max(2, ((col.seconds[e.key] ?? 0) / max) * PLOT_H - 2),
                            background: colorOf(e),
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X axis */}
            <div className="mt-2 flex">
              {columns.map((col, i) => (
                <span
                  key={i}
                  className={cn(
                    "flex-1 text-center text-[0.6875rem]",
                    col.isToday ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {showLabel(i) ? col.label : ""}
                </span>
              ))}
            </div>

            {/* Tooltip for the hovered column */}
            {hover !== null && columns[hover]?.total > 0 && (
              <ColumnTooltip
                column={columns[hover]}
                entities={entities}
                left={((hover + 0.5) / columns.length) * 100}
                // Just above the bar: x-axis band (~24px) + bar height + a small gap.
                bottom={24 + (columns[hover].total / max) * PLOT_H + 6}
                align={hover < columns.length * 0.2 ? "start" : hover > columns.length * 0.8 ? "end" : "center"}
              />
            )}
          </div>
        </div>

        {/* Breakdown: legend + table view in one */}
        {entities.length > 0 && (
          <ul className="mt-6 flex flex-col gap-4 border-t pt-5">
            {entities.map((e) => (
              <li key={e.key} className="flex flex-col gap-1.5">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(4rem,30%)_auto] items-center gap-4 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: colorOf(e) }} />
                    <span className="truncate font-medium">{e.label}</span>
                    {e.kind === "task" && (
                      <span className="shrink-0 rounded bg-muted px-1.5 py-px text-[0.6875rem] text-muted-foreground">
                        Task · no folder
                      </span>
                    )}
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${(e.seconds / topSeconds) * 100}%`, background: colorOf(e) }}
                    />
                  </span>
                  <span className="flex items-baseline justify-end gap-2 text-right">
                    <span className="font-medium tabular-nums">{formatDuration(e.seconds)}</span>
                    <span className="w-9 text-xs text-muted-foreground tabular-nums">
                      {Math.round((e.seconds / Math.max(1, total)) * 100)}%
                    </span>
                  </span>
                </div>
                {/* What it was spent on: tasks worked on in focus sessions, and writing notes. */}
                {e.parts.length > 0 && (
                  <ul className="ml-[5px] flex flex-col gap-1 border-l pl-4">
                    {e.parts.map((p) => (
                      <li key={p.label} className="flex items-baseline justify-between gap-4 text-xs">
                        <span className="truncate text-muted-foreground">{p.label}</span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">{formatDuration(p.seconds)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
        {byKey.get("u")?.parts.some((p) => p.label === "Focus with no task") && (
          <p className="mt-4 text-xs text-muted-foreground">
            Tip: pick a task in Pomodoro so your focus time lands in the right folder.
          </p>
        )}
      </div>
    </section>
  );
}

function ColumnTooltip({
  column,
  entities,
  left,
  bottom,
  align,
}: {
  column: TimeBreakdown["columns"][number];
  entities: TimeEntity[];
  left: number;
  bottom: number;
  align: "start" | "center" | "end";
}) {
  const rows = entities.filter((e) => (column.seconds[e.key] ?? 0) > 0);
  return (
    <div
      role="tooltip"
      className={cn(
        "pointer-events-none absolute z-10 w-max max-w-64 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md",
        align === "center" && "-translate-x-1/2",
        align === "end" && "-translate-x-full",
      )}
      style={{ left: `${left}%`, bottom }}
    >
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-medium">{column.fullLabel}</span>
        <span className="font-medium tabular-nums">{formatDuration(column.total)}</span>
      </div>
      <ul className="mt-1.5 flex flex-col gap-1">
        {rows.map((e) => (
          <li key={e.key} className="flex items-center justify-between gap-4">
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <span className="size-2 shrink-0 rounded-[2px]" style={{ background: colorOf(e) }} />
              <span className="truncate">{e.label}</span>
            </span>
            <span className="tabular-nums">{formatDuration(column.seconds[e.key] ?? 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
