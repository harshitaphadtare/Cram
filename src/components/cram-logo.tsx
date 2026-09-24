import { BookOpenCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** The Cram mark (same glyph as the favicon) with optional wordmark. */
export function CramLogo({ size = "md", withWordmark = true, className }: { size?: "sm" | "md" | "lg"; withWordmark?: boolean; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold", className)}>
      <span
        className={cn(
          "flex items-center justify-center rounded-md bg-foreground text-background",
          size === "sm" && "size-6 [&_svg]:size-3.5",
          size === "md" && "size-7 [&_svg]:size-4",
          size === "lg" && "size-10 rounded-lg [&_svg]:size-5",
        )}
      >
        <BookOpenCheck strokeWidth={2.25} />
      </span>
      {withWordmark && <span className={cn(size === "lg" ? "text-xl" : "text-[15px]")}>Cram</span>}
    </span>
  );
}
