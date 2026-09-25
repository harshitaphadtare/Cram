"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TASK_SORTS, TASK_SORT_COOKIE, type TaskSort } from "@/lib/task-sort";

/** Planner sort picker. The choice lives in a cookie so the server renders the right grouping
 * and it's remembered across visits. */
export function TaskSortMenu({ value }: { value: TaskSort }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: TaskSort) {
    document.cookie = `${TASK_SORT_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <Select value={value} onValueChange={(v) => change(v as TaskSort)}>
      <SelectTrigger
        size="sm"
        aria-label="Sort tasks"
        disabled={pending}
        className="border-transparent bg-transparent text-xs text-muted-foreground shadow-none hover:bg-muted hover:text-foreground dark:bg-transparent dark:hover:bg-muted"
      >
        <ArrowUpDown className="size-3.5" />
        <SelectValue>{(v: TaskSort) => <span>Sort: {TASK_SORTS[v]}</span>}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {(Object.keys(TASK_SORTS) as TaskSort[]).map((key) => (
          <SelectItem key={key} value={key}>
            {TASK_SORTS[key]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
