# Cram — your study buddy

Notion-style notes organized by folder, AI-generated quizzes (Gemini), Duolingo-style streaks, a
Todoist-style daily planner, and a Pomodoro timer — all in one calm, focused workspace. Folders
can be shared with friends with Viewer / Editor / Admin permissions.

## Tech stack

- **Next.js 16** (App Router, Server Actions) + TypeScript + Tailwind CSS v4
- **shadcn/ui** (Base UI primitives)
- **Prisma 7** ORM → **Supabase Postgres**
- **Supabase Auth** (email/password) for accounts, **Supabase Storage** for page images
- **Gemini 2.5 Flash** (Google AI Studio, free tier) for quiz generation
- **BlockNote** for the Notion-style page editor

## One-time setup

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project (free tier is fine).
2. **Project Settings → API**: copy the **Project URL**, **anon public** key, and
   **service_role** key.
3. **Project Settings → Database → Connection string**:
   - Copy the **Transaction pooler** string (port 6543) → this is `DATABASE_URL`.
   - Copy the **Session pooler** or **Direct connection** string (port 5432) → this is
     `DIRECT_URL`.
4. **Authentication → Providers**: Email should already be enabled. Under
   **Authentication → URL Configuration**, add `http://localhost:3000/auth/callback` (and your
   production URL later) to the Redirect URLs.
5. **Storage**: create a new bucket named exactly `page-uploads` and mark it **Public** (this is
   where note images get uploaded to).

### 2. Get a free Gemini API key

Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey), create a key. Free tier
is generous enough for personal use.

### 3. Fill in `.env`

Copy `.env.example` → `.env` and fill in the six values from steps 1–2:

```bash
cp .env.example .env
```

### 4. Push the database schema

```bash
npm install
npx prisma migrate dev --name init
```

### 5. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, confirm your email (check your
inbox — Supabase sends the confirmation link), and you're in.

## How sharing works

Every folder has an **Owner** (whoever created it). The owner or an **Admin** can share it with
anyone who already has a Cram account, at one of three levels:

- **Viewer** — can read pages and take quizzes, can't edit
- **Editor** — can also add/edit/delete pages
- **Admin** — can also invite/remove people and change their role

Quizzes, quiz history, and streaks are always personal — sharing a folder never shares someone
else's quiz results.

## Deploying

- **App**: push this repo to GitHub, import it on [Vercel](https://vercel.com/new), add the same
  environment variables from `.env` in the Vercel project settings.
- **Database/Auth/Storage**: already hosted on Supabase — no extra deploy step, just make sure
  your production URL is added to Supabase's Auth redirect URLs.
