"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Brain, CheckCircle2, CircleDashed, FileText, History, Sigma, Target, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeleteQuizButton } from "@/components/delete-quiz-button";
import { folderDotClass } from "@/lib/folder-colors";
import { cn } from "@/lib/utils";
import type { QuizHistoryData, QuizRow, SubjectStats } from "@/lib/data/quiz-history";

type Difficulty = QuizRow["difficulty"];
type StatusFilter = "all" | "completed" | "in_progress";
type Sort = "newest" | "oldest" | "highest" | "lowest";

const ALL = "all";
const DIFFICULTY_LABEL: Record<Difficulty, string> = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" };
const STATUS_LABEL: Record<StatusFilter, string> = { all: "Any status", completed: "Completed", in_progress: "In progress" };
const SORT_LABEL: Record<Sort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  highest: "Highest score",
  lowest: "Lowest score",
};

function scoreTone(percent: number): string {
  if (percent >= 80) return "bg-chart-3/15 text-foreground";
  if (percent >= 50) return "bg-streak/15 text-foreground";
  return "bg-destructive/10 text-destructive";
}

function barTone(percent: number): string {
  if (percent >= 80) return "bg-chart-3";
  if (percent >= 50) return "bg-streak";
  return "bg-destructive";
}

const pct = (n: number | null) => (n === null ? "—" : `${n}%`);

/** Recent scores as a tiny line, 0–100 on a fixed scale so subjects compare fairly. */
function Sparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) {
    return <span className="text-xs text-muted-foreground">Take another quiz to see a trend</span>;
  }
  const w = 120;
  const h = 28;
  const x = (i: number) => (i / (scores.length - 1)) * (w - 4) + 2;
  const y = (s: number) => h - 2 - (s / 100) * (h - 4);
  const points = scores.map((s, i) => `${x(i)},${y(s)}`).join(" ");
  const last = scores[scores.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-[120px] text-primary" role="img" aria-label={`Last ${scores.length} scores: ${scores.join(", ")}%`}>
      <line x1="2" x2={w - 2} y1={y(80)} y2={y(80)} className="stroke-muted-foreground/25" strokeDasharray="2 3" />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(scores.length - 1)} cy={y(last)} r="2.5" fill="currentColor" />
    </svg>
  );
}

function StatTile({ icon: Icon, label, value, hint }: { icon: typeof Brain; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function SubjectCard({ s, active, onSelect }: { s: SubjectStats; active: boolean; onSelect: () => void }) {
  const retention = s.retention ?? 0;
  const conceptPct = s.conceptsAsked ? Math.round((s.conceptsMastered / s.conceptsAsked) * 100) : null;
  return (
    <section className={cn("flex flex-col gap-4 rounded-xl border bg-card p-5 transition-colors", active && "border-primary ring-1 ring-primary")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("size-2.5 shrink-0 rounded-full", folderDotClass(s.color))} />
          <h3 className="truncate font-medium">{s.name}</h3>
        </div>
        <div className="text-right">
          <p className="text-2xl leading-none font-semibold tabular-nums">{pct(s.retention)}</p>
          <p className="mt-1 text-xs text-muted-foreground">retained now</p>
        </div>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className={cn("h-full rounded-full transition-[width]", barTone(retention))} style={{ width: `${retention}%` }} />
      </div>

      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Concepts mastered</dt>
          <dd className="font-medium tabular-nums">
            {s.conceptsMastered}/{s.conceptsAsked}
            {conceptPct !== null && <span className="ml-1 text-xs font-normal text-muted-foreground">({conceptPct}%)</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Notes covered</dt>
          <dd className="font-medium tabular-nums">
            {s.pagesQuizzed}/{s.pagesTotal} pages
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Due for review</dt>
          <dd className={cn("font-medium tabular-nums", s.dueForReview > 0 && "text-streak")}>
            {s.dueForReview} {s.dueForReview === 1 ? "page" : "pages"}
          </dd>
        </div>
      </dl>

      <div className="flex items-center justify-between gap-3">
        <Sparkline scores={s.scores} />
        <p className="text-xs text-muted-foreground">
          Avg <span className="font-medium text-foreground tabular-nums">{pct(s.averageScore)}</span> over last {s.scores.length}
        </p>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        {s.reviewNext ? (
          <Link
            href={`/app/folders/${s.folderId}/pages/${s.reviewNext.pageId}`}
            className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <FileText className="size-3.5 shrink-0" />
            <span className="truncate">
              Revise next: <span className="font-medium text-foreground">{s.reviewNext.title}</span> ({s.reviewNext.recall}%)
            </span>
          </Link>
        ) : (
          <span />
        )}
        <Button size="sm" variant={active ? "secondary" : "ghost"} onClick={onSelect} className="h-7 gap-1 text-xs">
          {active ? "Showing quizzes" : "Show quizzes"}
          <ArrowRight className="size-3" />
        </Button>
      </div>
    </section>
  );
}

/** Formulas in math type, without pulling in a maths library for a handful of symbols. */
function M({ children }: { children: React.ReactNode }) {
  return <span className="font-serif text-[1.05em] italic">{children}</span>;
}

function Frac({ top, bottom }: { top: React.ReactNode; bottom: React.ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex flex-col items-center align-middle text-[0.85em] leading-tight">
      <span className="px-0.5">{top}</span>
      <span className="border-t border-current px-0.5">{bottom}</span>
    </span>
  );
}

function Formulas() {
  return (
    <details className="group rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-sm font-medium">
        <Sigma className="size-4 text-muted-foreground" />
        How these numbers are worked out
        <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">Show</span>
        <span className="ml-auto hidden text-xs font-normal text-muted-foreground group-open:inline">Hide</span>
      </summary>
      <div className="grid gap-5 border-t px-5 py-4 text-sm md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h4 className="font-medium">Retained now (forgetting curve)</h4>
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-center">
            <M>R</M> = <M>m</M> · 0.9<sup><M>t</M> / <M>I</M></sup>
          </p>
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-center">
            Subject = <Frac top="1" bottom={<M>n</M>} />
            <span className="mx-0.5 inline-flex flex-col items-center align-middle leading-none">
              <span className="text-xl">Σ</span>
              <span className="text-[0.7em]">
                <M>i</M>=1…<M>n</M>
              </span>
            </span>
            <M>m</M>
            <sub>
              <M>i</M>
            </sub>{" "}
            · 0.9
            <sup>
              <M>t</M>
              <sub>i</sub> / <M>I</M>
              <sub>i</sub>
            </sup>
          </p>
          <p className="text-muted-foreground">
            averaged over the <M>n</M> pages of the subject you&apos;ve been quizzed on.
          </p>
          <ul className="flex flex-col gap-1 text-muted-foreground">
            <li>
              <M>m</M> is how well you know a page (0–100%), built from your quiz scores: <M>m</M>
              <sub>new</sub> = 0.4 · <M>m</M>
              <sub>old</sub> + 0.6 · score.
            </li>
            <li>
              <M>t</M> is the number of days since you last got quizzed on that page.
            </li>
            <li>
              <M>I</M> is its review interval in days. It grows 2.5× each time you score 80% or more, and resets to 1 day
              below 50%.
            </li>
            <li>
              On the review date (<M>t</M> = <M>I</M>) you&apos;re down to 90% of what you knew, and it keeps fading
              after that. That&apos;s why a page shows up as <span className="text-foreground">due for review</span>.
            </li>
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <h4 className="font-medium">Concepts mastered</h4>
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-center">
            questions whose <em>latest</em> answer was right ÷ different questions asked
          </p>
          <p className="text-muted-foreground">
            Each question counts once, however many times it came up, so getting it wrong then right later counts as
            mastered.
          </p>
          <h4 className="mt-2 font-medium">Notes covered and score</h4>
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-center">
            Covered = pages quizzed ÷ pages in subject
          </p>
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-center">Score = correct ÷ questions × 100</p>
          <p className="text-muted-foreground">
            The dashed line on each trend marks 80%, the score that stretches a page&apos;s review interval.
          </p>
        </div>
      </div>
    </details>
  );
}

function FilterSelect<T extends string>({
  value,
  onChange,
  options,
  label,
  render,
}: {
  value: T;
  onChange: (v: T) => void;
  options: T[];
  label: string;
  render: (v: T) => React.ReactNode;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger size="sm" aria-label={label} className="max-w-56">
        <SelectValue>{(v: T) => render(v)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {render(o)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function QuizHistory({ data }: { data: QuizHistoryData }) {
  const { quizzes, subjects, overall } = data;
  const [subject, setSubject] = useState<string>(ALL);
  const [difficulty, setDifficulty] = useState<Difficulty | typeof ALL>(ALL);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<Sort>("newest");

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.folderId, s])), [subjects]);

  const shown = useMemo(() => {
    const list = quizzes.filter(
      (q) =>
        (subject === ALL || q.folderId === subject) &&
        (difficulty === ALL || q.difficulty === difficulty) &&
        (status === "all" || (status === "completed" ? q.completed : !q.completed)),
    );
    // Unfinished quizzes have no score, so score sorts put them last.
    const score = (q: QuizRow, dir: 1 | -1) => (q.percent === null ? Infinity : dir * q.percent);
    return list.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return a.createdAt - b.createdAt;
        case "highest":
          return score(a, -1) - score(b, -1) || b.createdAt - a.createdAt;
        case "lowest":
          return score(a, 1) - score(b, 1) || b.createdAt - a.createdAt;
        default:
          return b.createdAt - a.createdAt;
      }
    });
  }, [quizzes, subject, difficulty, status, sort]);

  const shownScores = shown.filter((q) => q.percent !== null).map((q) => q.percent!);
  const shownAvg = shownScores.length ? Math.round(shownScores.reduce((s, x) => s + x, 0) / shownScores.length) : null;
  const filtered = subject !== ALL || difficulty !== ALL || status !== "all";

  function clearFilters() {
    setSubject(ALL);
    setDifficulty(ALL);
    setStatus("all");
  }

  if (quizzes.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-16 text-center text-muted-foreground">
        <History className="size-8" />
        <p>No quizzes yet.</p>
        <p className="text-sm">Open a folder and hit &ldquo;Quiz me&rdquo; to get started.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Overview */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile icon={Brain} label="Retained now" value={pct(overall.retention)} hint="across everything quizzed" />
        <StatTile
          icon={Target}
          label="Concepts mastered"
          value={`${overall.conceptsMastered}/${overall.conceptsAsked}`}
          hint="latest answer right"
        />
        <StatTile icon={CheckCircle2} label="Average score" value={pct(overall.averageScore)} hint={`${overall.completed} quizzes completed`} />
        <StatTile icon={History} label="Questions answered" value={String(overall.questionsAnswered)} hint="all time" />
      </div>

      {/* Retention by subject */}
      {subjects.length > 0 && (
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold">Retention by subject</h2>
            <p className="text-sm text-muted-foreground">How much you&apos;d likely remember if you were quizzed today. Weakest first.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {subjects.map((s) => (
              <SubjectCard
                key={s.folderId}
                s={s}
                active={subject === s.folderId}
                onSelect={() => setSubject(subject === s.folderId ? ALL : s.folderId)}
              />
            ))}
          </div>
          <Formulas />
        </section>
      )}

      {/* All quizzes */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">All quizzes</h2>
            <p className="text-sm text-muted-foreground">
              {shown.length} {shown.length === 1 ? "quiz" : "quizzes"}
              {shownAvg !== null && <> · average {shownAvg}%</>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            label="Subject"
            value={subject}
            onChange={setSubject}
            options={[ALL, ...subjects.map((s) => s.folderId)]}
            render={(v) => {
              const s = subjectById.get(v);
              return s ? (
                <span className="flex min-w-0 items-center gap-2">
                  <span className={cn("size-2 shrink-0 rounded-full", folderDotClass(s.color))} />
                  <span className="truncate">{s.name}</span>
                </span>
              ) : (
                "All subjects"
              );
            }}
          />
          <FilterSelect
            label="Difficulty"
            value={difficulty}
            onChange={setDifficulty}
            options={[ALL, "EASY", "MEDIUM", "HARD"] as (Difficulty | typeof ALL)[]}
            render={(v) => (v === ALL ? "Any difficulty" : DIFFICULTY_LABEL[v])}
          />
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={["all", "completed", "in_progress"]}
            render={(v) => STATUS_LABEL[v]}
          />
          <div className="ml-auto flex items-center gap-2">
            {filtered && (
              <Button size="sm" variant="ghost" onClick={clearFilters} className="h-7 gap-1 text-xs text-muted-foreground">
                <X className="size-3" />
                Clear filters
              </Button>
            )}
            <FilterSelect
              label="Sort"
              value={sort}
              onChange={setSort}
              options={["newest", "oldest", "highest", "lowest"]}
              render={(v) => SORT_LABEL[v]}
            />
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
            No quizzes match these filters.
            <Button size="sm" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {shown.map((quiz) => (
              <QuizItem key={quiz.id} quiz={quiz} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function QuizItem({ quiz }: { quiz: QuizRow }) {
  const href = quiz.completed ? `/app/quiz/${quiz.id}/results` : `/app/quiz/${quiz.id}`;
  return (
    // Delete button and the link are siblings, not nested: an <a> can't validly contain a <button>.
    <div className="group flex items-center gap-2 rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-accent">
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-4">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
            quiz.percent !== null ? scoreTone(quiz.percent) : "bg-muted text-muted-foreground",
          )}
        >
          {quiz.percent !== null ? `${quiz.percent}%` : <CircleDashed className="size-4" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("size-2 shrink-0 rounded-full", folderDotClass(quiz.folderColor))} />
            <p className="truncate font-medium">{quiz.folderName}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {quiz.dateLabel} · {DIFFICULTY_LABEL[quiz.difficulty]} · {quiz.totalQuestions} questions ·{" "}
            {quiz.pageCount} {quiz.pageCount === 1 ? "page" : "pages"}
          </p>
        </div>

        {quiz.percent !== null ? (
          <div className="hidden w-32 shrink-0 flex-col gap-1 sm:flex">
            <span className="text-right text-xs text-muted-foreground tabular-nums">
              {quiz.correctCount}/{quiz.totalQuestions} correct
            </span>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className={cn("h-full rounded-full", barTone(quiz.percent))} style={{ width: `${quiz.percent}%` }} />
            </div>
          </div>
        ) : (
          <Badge variant="outline" className="shrink-0 gap-1">
            <CheckCircle2 className="size-3" />
            Resume
          </Badge>
        )}
      </Link>

      <DeleteQuizButton quizId={quiz.id} label={`${quiz.folderName} quiz from ${quiz.dateLabel}`} />
    </div>
  );
}
