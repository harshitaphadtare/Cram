import { PRIORITY_META, PRIORITY_ORDER } from "@/lib/task-priority";
import type { TaskPriority } from "@/generated/prisma/enums";

export const TASK_SORTS = {
  date: "Due date",
  priority: "Priority",
  subject: "Subject",
  name: "Name (A–Z)",
} as const;

export type TaskSort = keyof typeof TASK_SORTS;

export const TASK_SORT_COOKIE = "planner-sort";

export function parseTaskSort(value: string | undefined): TaskSort {
  return value && value in TASK_SORTS ? (value as TaskSort) : "date";
}

interface SortableTask {
  title: string;
  dueDate: Date | null;
  priority: TaskPriority;
  order: number;
  folder?: { name: string } | null;
}

export interface TaskGroup<T> {
  key: string;
  label: string;
  tasks: T[];
  tone?: "danger";
  /** Subject colour, when grouped by subject. */
  color?: string;
}

const byDate = (a: SortableTask, b: SortableTask) =>
  (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity);
const byPriority = (a: SortableTask, b: SortableTask) =>
  PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank;
const byTitle = (a: SortableTask, b: SortableTask) =>
  a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true });

/** Chain comparators: the first non-zero result wins. */
function chain<T>(...cmps: ((a: T, b: T) => number)[]) {
  return (a: T, b: T) => {
    for (const cmp of cmps) {
      const r = cmp(a, b);
      if (r !== 0) return r;
    }
    return 0;
  };
}

/** Splits active tasks into labelled groups for the chosen sort; empty groups are dropped. */
export function groupTasks<T extends SortableTask & { folder?: { name: string; color?: string } | null }>(
  tasks: T[],
  sort: TaskSort,
  today: Date,
): TaskGroup<T>[] {
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const byOrder = (a: T, b: T) => a.order - b.order;
  let groups: TaskGroup<T>[];

  switch (sort) {
    case "priority":
      groups = PRIORITY_ORDER.map((p) => ({
        key: p,
        label: PRIORITY_META[p].label,
        tasks: tasks.filter((t) => t.priority === p).sort(chain(byDate, byTitle)),
      }));
      break;

    case "subject": {
      const names = [...new Set(tasks.flatMap((t) => (t.folder ? [t.folder.name] : [])))].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
      );
      groups = [
        ...names.map((name) => {
          const inSubject = tasks.filter((t) => t.folder?.name === name);
          return {
            key: `subject:${name}`,
            label: name,
            color: inSubject[0]?.folder?.color,
            tasks: inSubject.sort(chain(byDate, byPriority, byTitle)),
          };
        }),
        {
          key: "subject:none",
          label: "No subject",
          tasks: tasks.filter((t) => !t.folder).sort(chain(byDate, byPriority, byTitle)),
        },
      ];
      break;
    }

    case "name":
      groups = [{ key: "all", label: "All tasks", tasks: [...tasks].sort(chain(byTitle, byDate)) }];
      break;

    default: {
      const within = chain(byDate, byPriority, byOrder);
      groups = [
        {
          key: "overdue",
          label: "Overdue",
          tone: "danger",
          tasks: tasks.filter((t) => t.dueDate && t.dueDate < today).sort(within),
        },
        {
          key: "today",
          label: "Today",
          tasks: tasks.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate < tomorrow).sort(within),
        },
        {
          key: "upcoming",
          label: "Upcoming",
          tasks: tasks.filter((t) => t.dueDate && t.dueDate >= tomorrow).sort(within),
        },
        { key: "none", label: "No date", tasks: tasks.filter((t) => !t.dueDate).sort(within) },
      ];
    }
  }

  return groups.filter((g) => g.tasks.length > 0);
}
