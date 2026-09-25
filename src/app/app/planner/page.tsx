import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { listTasksForUser } from "@/lib/data/tasks";
import { NewTaskForm } from "@/components/new-task-form";
import { TaskItem, TaskList } from "@/components/task-item";
import { TaskSortMenu } from "@/components/task-sort-menu";
import { SubjectDot } from "@/components/subjects";
import { CalendarCheck2 } from "lucide-react";
import { todayDateOnly } from "@/lib/date-only";
import { groupTasks, parseTaskSort, TASK_SORT_COOKIE } from "@/lib/task-sort";
import { cn } from "@/lib/utils";

export default async function PlannerPage() {
  const user = await requireUser();
  const [tasks, cookieStore] = await Promise.all([listTasksForUser(user.id), cookies()]);
  const sort = parseTaskSort(cookieStore.get(TASK_SORT_COOKIE)?.value);

  const today = todayDateOnly();

  // Repeating tasks made before they carried a date still belong on today's list.
  const active = tasks
    .filter((t) => !t.completed)
    .map((t) => (t.recurring && !t.dueDate ? { ...t, dueDate: today } : t));
  const completed = tasks.filter((t) => t.completed);
  const groups = groupTasks(active, sort, today);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-16">
      <div>
        <h1 className="text-3xl font-semibold">Planner</h1>
        <p className="text-muted-foreground">Plan your day, one task at a time.</p>
      </div>

      <div data-tour="planner-input">
        <NewTaskForm defaultDueDate={new Date()} />
      </div>

      {groups.length === 0 && completed.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <CalendarCheck2 className="size-6 text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-medium">Nothing on your plate</p>
            <p className="text-sm text-muted-foreground">
              Add your first task above — it’ll show up here, sorted by when it’s due.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="-mb-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {active.length} {active.length === 1 ? "task" : "tasks"} to do
            </p>
            <TaskSortMenu value={sort} />
          </div>

          <div className="cram-stagger flex flex-col gap-6">
            {groups.map((group) => (
              <section key={group.key} className="flex flex-col gap-2">
                <GroupHeading
                  label={group.label}
                  count={group.tasks.length}
                  danger={group.tone === "danger"}
                  color={group.color}
                />
                <TaskList>
                  {group.tasks.map((task) => (
                    <TaskItem key={task.id} task={task} hideSubject={sort === "subject"} />
                  ))}
                </TaskList>
              </section>
            ))}

            {completed.length > 0 && (
              <section className="flex flex-col gap-2">
                <GroupHeading label="Completed" count={completed.length} />
                <TaskList>
                  {completed.map((task) => (
                    <TaskItem key={task.id} task={task} />
                  ))}
                </TaskList>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GroupHeading({
  label,
  count,
  danger,
  color,
}: {
  label: string;
  count: number;
  danger?: boolean;
  color?: string;
}) {
  return (
    <h2 className="flex items-center gap-2 px-1 text-sm font-semibold">
      {color && <SubjectDot color={color} />}
      <span className={cn(danger && "text-destructive")}>{label}</span>
      <span className="font-normal text-muted-foreground">{count}</span>
    </h2>
  );
}
