import { TaskPriority } from "@/generated/prisma/enums";

export const PRIORITY_META: Record<TaskPriority, { label: string; dot: string; text: string }> = {
  P1: { label: "Urgent", dot: "bg-destructive", text: "text-destructive" },
  P2: { label: "Important", dot: "bg-[oklch(0.72_0.16_55)]", text: "text-[oklch(0.62_0.16_55)]" },
  P3: { label: "Normal", dot: "bg-primary", text: "text-primary" },
  P4: { label: "Someday", dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
};

export const PRIORITY_ORDER: TaskPriority[] = [
  TaskPriority.P1,
  TaskPriority.P2,
  TaskPriority.P3,
  TaskPriority.P4,
];
