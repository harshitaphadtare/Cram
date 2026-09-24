import { cn } from "@/lib/utils";

/** A single shimmering placeholder block. */
export function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

/** Generic page placeholder: title, subtitle and a few content blocks. Shown instantly on navigation. */
export function PageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8" aria-busy="true" aria-label="Loading">
      <div className="flex flex-col gap-2">
        <Bone className="h-4 w-40" />
        <Bone className="h-8 w-72" />
      </div>
      <Bone className="h-32 w-full rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Bone className="h-40 rounded-xl" />
        <Bone className="h-40 rounded-xl" />
      </div>
    </div>
  );
}
