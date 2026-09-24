export const FOLDER_COLORS = [
  { value: "teal", label: "Teal", dot: "bg-[oklch(0.52_0.09_195)]" },
  { value: "amber", label: "Amber", dot: "bg-[oklch(0.72_0.16_55)]" },
  { value: "sage", label: "Sage", dot: "bg-[oklch(0.6_0.1_145)]" },
  { value: "coral", label: "Coral", dot: "bg-[oklch(0.62_0.13_25)]" },
  { value: "violet", label: "Violet", dot: "bg-[oklch(0.55_0.1_280)]" },
  { value: "slate", label: "Slate", dot: "bg-[oklch(0.5_0.02_255)]" },
] as const;

export type FolderColorValue = (typeof FOLDER_COLORS)[number]["value"];

export function folderDotClass(color: string): string {
  return FOLDER_COLORS.find((c) => c.value === color)?.dot ?? FOLDER_COLORS[0].dot;
}
