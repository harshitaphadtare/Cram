"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Difficulty } from "@/generated/prisma/enums";
import { startQuiz } from "@/app/actions/quiz";

type PageOption = { id: string; title: string };
type SelectionMode = "all" | "range" | "random" | "manual";

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string; hint: string }[] = [
  { value: Difficulty.EASY, label: "Easy", hint: "Recall the basics" },
  { value: Difficulty.MEDIUM, label: "Medium", hint: "Apply what you know" },
  { value: Difficulty.HARD, label: "Hard", hint: "Deep, tricky questions" },
];

export function QuizMeDialog({ folderId, pages }: { folderId: string; pages: PageOption[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<SelectionMode>("all");
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(Math.max(pages.length, 1));
  const [randomCount, setRandomCount] = useState(Math.min(5, pages.length || 1));
  const [manualSelected, setManualSelected] = useState<Set<string>>(new Set());
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [questionCount, setQuestionCount] = useState(8);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Count only (for display/validation) — kept pure and memoizable, unlike the actual
  // page-id resolution below, which shuffles for "random" mode and must run at submit time.
  const selectedCount = useMemo(() => {
    switch (mode) {
      case "all":
        return pages.length;
      case "range": {
        const start = Math.max(1, Math.min(rangeStart, pages.length));
        const end = Math.max(start, Math.min(rangeEnd, pages.length));
        return Math.max(0, end - start + 1);
      }
      case "random":
        return Math.min(randomCount, pages.length);
      case "manual":
        return manualSelected.size;
    }
  }, [mode, pages.length, rangeStart, rangeEnd, randomCount, manualSelected]);

  function resolveSelectedPageIds(): string[] {
    switch (mode) {
      case "all":
        return pages.map((p) => p.id);
      case "range": {
        const start = Math.max(1, Math.min(rangeStart, pages.length));
        const end = Math.max(start, Math.min(rangeEnd, pages.length));
        return pages.slice(start - 1, end).map((p) => p.id);
      }
      case "random": {
        const shuffled = [...pages].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(randomCount, pages.length)).map((p) => p.id);
      }
      case "manual":
        return pages.filter((p) => manualSelected.has(p.id)).map((p) => p.id);
    }
  }

  function toggleManual(id: string) {
    setManualSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSubmit() {
    const selectedPageIds = resolveSelectedPageIds();
    if (selectedPageIds.length === 0) {
      toast.error("Select at least one page.");
      return;
    }
    startTransition(async () => {
      try {
        const quizId = await startQuiz({
          folderId,
          pageIds: selectedPageIds,
          difficulty,
          questionCount,
        });
        setOpen(false);
        router.push(`/app/quiz/${quizId}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't generate the quiz.");
      }
    });
  }

  const disabled = pages.length === 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" disabled={disabled} className="gap-1.5" data-tour="quiz-me">
            <Sparkles className="size-4" />
            Quiz me
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quiz me</DialogTitle>
          <DialogDescription>
            Gemini will write questions from your notes. Pick what to cover.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>Which pages?</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as SelectionMode)}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="all" id="mode-all" />
                <Label htmlFor="mode-all" className="font-normal">
                  All pages ({pages.length})
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="range" id="mode-range" />
                <Label htmlFor="mode-range" className="font-normal">
                  A range of pages
                </Label>
                {mode === "range" && (
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={1}
                      max={pages.length}
                      value={rangeStart}
                      onChange={(e) => setRangeStart(Number(e.target.value))}
                      className="h-7 w-16"
                    />
                    <span className="text-muted-foreground text-sm">to</span>
                    <Input
                      type="number"
                      min={1}
                      max={pages.length}
                      value={rangeEnd}
                      onChange={(e) => setRangeEnd(Number(e.target.value))}
                      className="h-7 w-16"
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="random" id="mode-random" />
                <Label htmlFor="mode-random" className="font-normal">
                  Random pages
                </Label>
                {mode === "random" && (
                  <Input
                    type="number"
                    min={1}
                    max={pages.length}
                    value={randomCount}
                    onChange={(e) => setRandomCount(Number(e.target.value))}
                    className="h-7 w-16"
                  />
                )}
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="manual" id="mode-manual" />
                <Label htmlFor="mode-manual" className="font-normal">
                  Choose specific pages
                </Label>
              </div>
            </RadioGroup>

            {mode === "manual" && (
              <ScrollArea className="h-32 rounded-md border p-2">
                <div className="flex flex-col gap-1.5">
                  {pages.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={manualSelected.has(p.id)}
                        onCheckedChange={() => toggleManual(p.id)}
                      />
                      {p.title}
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Difficulty</Label>
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDifficulty(opt.value)}
                  className={`rounded-lg border p-2.5 text-left transition ${
                    difficulty === opt.value
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.hint}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="question-count">Number of questions</Label>
            <Input
              id="question-count"
              type="number"
              min={3}
              max={20}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="w-24"
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSubmit} disabled={pending || selectedCount === 0}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {pending ? "Generating…" : "Start quiz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
