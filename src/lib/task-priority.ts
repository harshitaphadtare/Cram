import { TaskPriority } from "@/generated/prisma/enums";

export const PRIORITY_META: Record<
  TaskPriority,
  { label: string; dot: string; text: string; check: string; rank: number }
> = {
  P1: {
    label: "Urgent",
    dot: "bg-destructive",
    text: "text-destructive",
    check: "border-destructive bg-destructive/10 text-destructive",
    rank: 0,
  },
  P2: {
    label: "Important",
    dot: "bg-[oklch(0.72_0.16_55)]",
    text: "text-[oklch(0.62_0.16_55)]",
    check: "border-[oklch(0.72_0.16_55)] bg-[oklch(0.72_0.16_55/0.1)] text-[oklch(0.72_0.16_55)]",
    rank: 1,
  },
  P3: {
    label: "Normal",
    dot: "bg-primary",
    text: "text-primary",
    check: "border-primary bg-primary/10 text-primary",
    rank: 2,
  },
  P4: {
    label: "Someday",
    dot: "bg-muted-foreground/40",
    text: "text-muted-foreground",
    check: "border-muted-foreground/50 text-muted-foreground",
    rank: 3,
  },
};

export const PRIORITY_ORDER: TaskPriority[] = [
  TaskPriority.P1,
  TaskPriority.P2,
  TaskPriority.P3,
  TaskPriority.P4,
];
