import { requireUser } from "@/lib/auth";
import { listTasksForUser } from "@/lib/data/tasks";
import { NewTaskForm } from "@/components/new-task-form";
import { TaskItem } from "@/components/task-item";
import { CalendarCheck2 } from "lucide-react";
import { todayDateOnly } from "@/lib/date-only";

export default async function PlannerPage() {
  const user = await requireUser();
  const tasks = await listTasksForUser(user.id);

  const today = todayDateOnly();
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const active = tasks.filter((t) => !t.completed);
  const completed = tasks.filter((t) => t.completed);

  const overdue = active.filter((t) => t.dueDate && t.dueDate < today);
  const dueToday = active.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate < tomorrow);
  const upcoming = active.filter((t) => t.dueDate && t.dueDate >= tomorrow);
  const noDate = active.filter((t) => !t.dueDate);

  const sections = [
    { label: "Overdue", tasks: overdue, emphasize: true },
    { label: "Today", tasks: dueToday },
    { label: "Upcoming", tasks: upcoming },
    { label: "No date", tasks: noDate },
  ].filter((s) => s.tasks.length > 0);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-16">
      <div>
        <h1 className="text-3xl font-semibold">Planner</h1>
        <p className="text-muted-foreground">Plan your day, one task at a time.</p>
      </div>

      <div data-tour="planner-input">
        <NewTaskForm defaultDueDate={new Date()} />
      </div>

      {sections.length === 0 && completed.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          <CalendarCheck2 className="size-8" />
          <p>Nothing on your plate. Add a task above.</p>
        </div>
      ) : (
        <div className="cram-stagger flex flex-col gap-6">
          {sections.map((section) => (
            <div key={section.label} className="flex flex-col gap-2">
              <h2
                className={
                  section.emphasize
                    ? "text-sm font-medium text-destructive"
                    : "text-sm font-medium text-muted-foreground"
                }
              >
                {section.label} · {section.tasks.length}
              </h2>
              <div className="flex flex-col gap-1.5">
                {section.tasks.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            </div>
          ))}

          {completed.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                Completed · {completed.length}
              </h2>
              <div className="flex flex-col gap-1.5">
                {completed.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
