# Deploying Cram

Cram runs on **Vercel** (the Next.js app) and **Supabase** (database, auth, file storage), both
of which have free tiers that are fine for a student project.

**Current production:** [cram-eta.vercel.app](https://cram-eta.vercel.app), deployed from `main`
with server functions in Sydney (`syd1`), next to the Supabase database (`ap-southeast-2`).

## Before you start
- [ ] The code you want to ship is on `main` on GitHub.
- [ ] `npm run build` passes locally.
- [ ] You have your six environment values from `.env` (see `.env.example`).

## 1. Database
The production app uses the Supabase project in your `.env`. Apply any pending migrations:

```bash
npm run db:deploy
```

`migrate deploy` only applies new migrations; it never resets data. Run it again whenever a
change adds a folder under `prisma/migrations/`, **before** that code goes live.

> Want production data separate from your dev data? Create a second Supabase project, put its
> values in Vercel, and run `npm run db:deploy` with those values in `.env` once.

## 2. Vercel
1. Go to [vercel.com/new](https://vercel.com/new), sign in with GitHub, and **import** the `Cram` repo.
2. Framework preset: **Next.js** (auto-detected). Leave the build command as is — `npm install`
   runs `prisma generate` automatically (`postinstall`), then `next build`.
   Skip the optional **Prisma Postgres** / **Supabase** integrations Vercel offers: Cram uses your
   existing Supabase project through the variables below.
3. **Environment variables**: add all six, for *Production* and *Preview*:

   | Name | Where it comes from |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page (`anon` key) |
   | `SUPABASE_SERVICE_ROLE_KEY` | same page (`service_role` key — keep secret) |
   | `DATABASE_URL` | Supabase → Database → Connection string → **Transaction pooler** (port 6543) |
   | `DIRECT_URL` | same → **Session pooler** (port 5432) |
   | `GEMINI_API_KEY` | Google AI Studio |

4. Click **Deploy**. You'll get a URL like `https://cram-xyz.vercel.app`.

**Region:** `vercel.json` pins server functions to `syd1` because the database is in Sydney.
Keep these matched — if the functions run far from the database (Vercel's default is `iad1`,
Washington DC), every query crosses an ocean and each page takes seconds. You can confirm the
region with `curl -sI <your-url> | grep -i x-vercel-id` — the second code should be `syd1`.

## 3. Point Supabase at the live site
Supabase → **Authentication → URL Configuration**:
- **Site URL**: your Vercel URL (e.g. `https://cram-xyz.vercel.app`).
- **Redirect URLs**: add `https://cram-xyz.vercel.app/**` (keep `http://localhost:3000/**` for dev).

If you use Google sign-in, add the Vercel URL to Google's **Authorised JavaScript origins** too
(see `docs/AUTH-PROVIDERS.md`). The Supabase callback URL doesn't change.

## 4. Email (important for real users)
Supabase's built-in email sender is for testing only: it sends just a few emails per hour, so
sign-up confirmations and password resets will start failing once real students sign up.

1. Create a free account with an email provider such as [Resend](https://resend.com) and verify a
   sending domain (or use their test domain to start).
2. Supabase → **Authentication → Emails → SMTP Settings** → enable custom SMTP and paste the
   provider's host, port, username and password.
3. Optionally customise the **Confirm signup** and **Reset password** email templates with the
   Cram name.

## 5. Custom domain (optional)
Vercel → Project → **Settings → Domains** → add your domain and follow the DNS instructions. Then
update the Supabase Site URL / Redirect URLs and Google origins to the new domain.

## 6. After deploying
- [ ] Run the checklist in `docs/TESTING.md` against the live URL.
- [ ] Sign up with a new account on the live site and confirm the email arrives.
- [ ] Try "Forgot password" on the live site.

## Good to know
- **Free Supabase projects pause after a week with no activity.** Open the dashboard to wake it,
  or upgrade if students depend on it.
- **Gemini free tier** has daily limits; if quizzes start failing with quota errors, add billing
  in Google AI Studio or lower usage.
- **Licence**: Cram uses `@blocknote/xl-multi-column` (GPL-3.0). Keep the GitHub repo public, or
  buy a BlockNote licence, if you distribute Cram.
- **Uploads** are capped at 4 MB per image, because Vercel rejects request bodies over 4.5 MB.
- **Updates**: every push to `main` redeploys automatically. Pull-request branches get their own
  preview URLs.
