# Cram

**Study a little every day. Remember it for good.**

Cram is a study workspace for students: Notion-style notes organised by subject, AI quizzes
generated from your own notes, spaced review that tells you what you're about to forget, a
focus timer, and a gamified streak/XP system designed to bring you back every day.

## Features

### Notes
- **Notion-style editor** (BlockNote): headings, lists, tables, images, code, toggles and
  **multi-column layouts** (type `/col`, or drag a block to another block's side).
- **Page options** (`⋯` next to the title): *Full width*, *Small text*, *Copy link*.
- **Folders as subjects**, with a page tree in the sidebar.
- **Heading outline**: a rail of dashes on the right edge; hover it for a clickable,
  indented table of contents.
- **Tabs**: open several pages at once. `+` opens a new tab; Ctrl/Cmd+click or middle-click any
  link opens it in a background tab.
- **Breadcrumbs** with hover menus to jump between sections, folders and pages.
- **Search** (`Ctrl/Cmd + K`) across titles *and* the text inside your notes.

### Learning
- **AI quizzes** (Gemini) from any selection of pages, at three difficulties. Every wrong answer
  links back to the page it came from.
- **Spaced repetition**: each quiz updates a per-page *mastery* score and schedules the next
  review (strong recall stretches the interval, weak recall brings it back tomorrow).
  Due pages show on Home and on the folder page with a one-click **Review** quiz.

### Planning
- **Planner** with natural-language dates ("review notes tomorrow", "stretch everyday"),
  priorities, repeating tasks and an optional **subject** per task.
- **Folder page sidebar**: a **To-do** list for that subject and a **Roadmap**, a checklist of
  every topic to cover, with a progress bar.
- **Pomodoro** timer that keeps running across the app (mini timer in the top bar, countdown in
  the browser tab).

### Motivation (gamification)
- **Daily goal ring**: pick 10–90 min or set a custom goal (up to 12 hours). Focus sessions
  *and* time spent writing notes both count.
- **Streaks** with **streak freezes** (one earned per week, max 2) that protect a missed day.
- **XP and levels**, **17 achievements**, and celebration popups for unlocks and level-ups.
- **Progress page**: level, stats, 12-week activity heatmap and every achievement.
- **Weekly leaderboards** in shared folders (opt out in Settings).

| Action | XP |
| --- | --- |
| Each minute of focus or note-writing | 1 |
| Completing a quiz | 10, +5 per correct answer, +20 for a perfect score |
| Hitting your daily goal | 20 |
| Completing a task | 5 (first 10 per day) |
| Covering a roadmap topic | 10 (first 10 per day) |

A day counts toward your streak after a focus session, a quiz, or 5 minutes of writing notes.

### Accounts
- Email/password sign-up with a **strong-password policy**: at least 10 characters with upper-
  and lowercase letters, a number and a symbol, shown as a live checklist and strength meter.
- **Forgot password**: `/forgot-password` emails a reset link, which leads to
  `/reset-password` to choose a new password. The link must be opened in the same browser that
  requested it.

### Collaboration
Folders can be shared with other Cram users as **Viewer** (read and quiz), **Editor** (edit
pages) or **Admin** (also manage members). Quizzes, streaks, XP, to-dos and roadmaps are always
personal.

## Tech stack

- **Next.js 16** (App Router, Server Actions, Turbopack) + TypeScript
- **Tailwind CSS v4** + **shadcn/ui** on **Base UI** primitives
- **Prisma 7** → **Supabase Postgres**
- **Supabase Auth** (email/password) and **Supabase Storage** (note images)
- **BlockNote** editor + `@blocknote/xl-multi-column`
- **Google Gemini** for quiz generation

## Getting started

### 1. Supabase
1. Create a project at [supabase.com](https://supabase.com) (the free tier is fine).
2. **Project Settings → API**: copy the Project URL, the `anon` key and the `service_role` key.
3. **Project Settings → Database → Connection string**: copy the **Transaction pooler** string
   (port 6543) for `DATABASE_URL`, and the **Session pooler / direct** string (port 5432) for
   `DIRECT_URL`.
4. **Authentication → URL Configuration**: add `http://localhost:3000/**` (and the same for
   your production URL later) to the redirect URLs. Sign-up confirmation and password-reset
   emails both return through `/auth/callback`.
5. **Authentication → Providers → Email → Password requirements**: set the minimum length to
   **10** and require lowercase, uppercase, digits and symbols. The sign-up, reset and
   change-password forms enforce the same rules, but this makes Supabase enforce them too.
6. **Storage**: create a **public** bucket named `page-uploads`.

### 2. Gemini
Create a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

### 3. Environment
```bash
cp .env.example .env
```
Fill in the six values. `.env` is git-ignored; never commit it.

### 4. Install and migrate
```bash
npm install          # also runs `prisma generate`
npm run db:deploy    # applies database migrations
```

### 5. Run
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000), sign up, confirm your email, and you're in.

## Guides

- [Google & Microsoft sign-in setup](docs/AUTH-PROVIDERS.md)
- [Manual test checklist](docs/TESTING.md)
- [Deploying to Vercel + Supabase](docs/DEPLOYMENT.md)

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (includes type-checking) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npx prisma migrate dev --name <change>` | Create a new migration after editing `prisma/schema.prisma` |
| `npm run db:deploy` | Apply pending migrations (safe: never resets data) |

## Project structure

```
prisma/
  schema.prisma          Data model
  migrations/            SQL migrations
src/
  app/
    page.tsx             Public landing page
    login/ signup/       Auth pages
    app/                 The signed-in app (layout = sidebar, tabs, breadcrumb, timer)
      page.tsx           Home dashboard
      folders/[folderId]/            Folder: pages, to-do, roadmap, leaderboard
      folders/[folderId]/pages/[pageId]/  Page editor
      planner/ pomodoro/ quizzes/ quiz/ progress/ settings/
    actions/             Server actions (pages, tasks, quiz, roadmap, gamification, search, …)
  components/            UI (editor, sidebar, tabs, command palette, gamification widgets, …)
  lib/
    gamification.ts      Streaks, freezes, XP crediting, achievements, spaced repetition
    achievements.ts      Achievement definitions
    levels.ts            XP → level curve
    data/                Server-side queries
```

## Deploying

- **App**: import the repo on [Vercel](https://vercel.com/new) and add the same environment
  variables as in `.env`.
- **Database**: run `npx prisma migrate deploy` against production before (or as part of) each
  deploy that includes new migrations.
- Add your production URL to Supabase's Auth redirect URLs.

## License

Cram uses `@blocknote/xl-multi-column`, which is licensed under **GPL-3.0** (or a commercial
BlockNote license). Distributing Cram therefore requires making its source available under
GPL-3.0-compatible terms, or buying a BlockNote license.
