import { cn } from "@/lib/utils";

/**
 * The Cram mark: a bold "C" drawn as an almost-closed progress ring — the same shape as the daily
 * goal ring — with an amber dot in the gap marking progress. Matches src/app/icon.svg.
 */
export function CramMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <rect width="32" height="32" rx="8" className="fill-foreground" />
      <path
        d="M22.36 9.64 A9 9 0 1 0 22.36 22.36"
        fill="none"
        strokeWidth="3.6"
        strokeLinecap="round"
        className="stroke-background"
      />
      <circle cx="24.6" cy="16" r="2.1" fill="#ff9f43" />
    </svg>
  );
}

/** Mark + "CRAM" wordmark (set in the brand face, wide-tracked caps). */
export function CramLogo({
  size = "md",
  withWordmark = true,
  className,
}: {
  size?: "sm" | "md" | "lg";
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <CramMark
        className={cn("shrink-0", size === "sm" && "size-6", size === "md" && "size-7", size === "lg" && "size-10")}
      />
      {withWordmark && (
        <span
          className={cn(
            "font-brand leading-none font-bold tracking-[0.16em] text-foreground",
            size === "lg" ? "text-xl" : size === "sm" ? "text-[0.8125rem]" : "text-[0.9375rem]",
          )}
        >
          CRAM
        </span>
      )}
    </span>
  );
}
