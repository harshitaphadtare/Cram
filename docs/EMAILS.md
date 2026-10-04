# Reminder emails

> **Current status: owner only.** Sending email to anyone means proving to Resend that you own
> the sender's domain, and a `.vercel.app` address can't be verified, so emailing every student
> needs a **paid domain**. Cram is a free personal project, so the live site
> (cram-eta.vercel.app) runs reminders for **one account only, the owner's**, using Resend's free
> test sender. Other students don't get reminder emails and don't see the email settings.
>
> Everything is built for all students. To turn it on for everyone, follow
> [Setup B](#setup-b-every-student-needs-a-domain) below. It's configuration only, no code changes.

Cram sends Duolingo-style reminder emails through [Resend](https://resend.com). Each one goes out
at a set time of the student's own day (from their timezone in Settings), only when there's a
reason to, and at most once per day per kind.

| Email | When (student's local time) | Sent if | Setting |
| --- | --- | --- | --- |
| **Morning plan** | 08:00 | A task is due today (daily), or pages are due for review / tasks are overdue (at most every other day). Only for students active in the last 14 days. | Morning plan |
| **Weekly recap** | Sunday 18:00 | They studied at least one day that week. Study time, days, XP, streak, level, unlocks. | Weekly recap |
| **Comeback** | 18:00 | 2, 7 and 21 days after they last studied (1 and 4 days after sign-up if they never have). Then nothing until they're back. | Streak reminders |
| **Streak at risk** | 20:00 | They have a live streak and haven't studied today. Mentions it if a freeze would cover the day. | Streak reminders |

Students turn each kind on or off in **Settings → Email notifications**. Every email has an
**Unsubscribe** link (a page with a confirm button, which works signed out) and a one-click
`List-Unsubscribe` header, so Gmail and Apple Mail show their own Unsubscribe button.

## How it works

1. A scheduler (Supabase pg_cron) calls `GET /api/cron/emails` once an hour with
   `Authorization: Bearer $CRON_SECRET`.
2. The route (`src/app/api/cron/emails/route.ts`) runs `runReminders`
   (`src/lib/email/reminders.ts`), which works out each student's local hour and decides what,
   if anything, they get.
3. Every send is recorded in the `email_logs` table first, so overlapping runs can't
   double-send. Templates are in `src/lib/email/templates.ts`; sending is in
   `src/lib/email/send.ts`.

| File | What it does |
| --- | --- |
| `src/lib/email/reminders.ts` | Who gets what, and when (send hours and rules are at the top) |
| `src/lib/email/templates.ts` | The four emails, as inline-styled HTML + plain text |
| `src/lib/email/send.ts` | Resend API call; `EMAIL_REMINDERS_FOR` / `EMAIL_DELIVER_TO` handling |
| `src/lib/email/unsubscribe.ts` | Signed unsubscribe links |
| `src/app/email/unsubscribe/page.tsx` | Unsubscribe confirm page |
| `src/app/api/email/unsubscribe/route.ts` | One-click unsubscribe for mail apps |
| `src/components/email-preferences.tsx` | Settings → Email notifications |

## Environment variables

| Variable | Setup A (owner only) | Setup B (every student) |
| --- | --- | --- |
| `RESEND_API_KEY` | Required: Resend → API Keys | Required |
| `CRON_SECRET` | Required: a long random string (see below) | Required |
| `EMAIL_REMINDERS_FOR` | Required: your Cram account's email | **Leave unset** (unset = everyone) |
| `EMAIL_DELIVER_TO` | Only if your Resend account uses a different email than your Cram account: the Resend one | **Leave unset** |
| `EMAIL_FROM` | Leave unset (uses `onboarding@resend.dev`) | Required: e.g. `Cram <reminders@mail.yourdomain.com>` |
| `APP_URL` | Optional: links in emails; defaults to `https://cram-eta.vercel.app` | Optional |

`CRON_SECRET` authorises the hourly call **and** signs unsubscribe links. Generate one with
`openssl rand -base64 32` (or any password generator), put the same value in Vercel and in your
local `.env`, and don't change it casually: links in emails already sent stop working.

## Setup A: just the owner (free, what Cram uses)

Resend's shared test sender (`onboarding@resend.dev`) can only deliver to the email address the
Resend account was created with. That's enough for one person:

1. Create a free Resend account and an API key.
2. In Vercel → **Settings → Environment Variables** (Production), set the Setup A column above.
   If your Resend login and your Cram login are different addresses, set `EMAIL_DELIVER_TO` to
   the Resend one: emails are still built from your Cram account's data, but land in the inbox
   Resend is allowed to reach.
3. Redeploy, then [test](#test-it) and [schedule](#schedule-the-hourly-run-supabase-pg_cron).

## Setup B: every student (needs a domain)

1. **Get a domain** (Cloudflare, Namecheap, Porkbun… from about $10/year) or use one you own.
2. **Verify it in Resend:** Resend → **Domains → Add domain**. A subdomain such as
   `mail.yourdomain.com` keeps reminder mail separate from anything else on the domain.
3. **Add the DNS records** Resend shows (SPF, DKIM, and the recommended DMARC record) at your
   domain provider, then click **Verify**. It usually takes a few minutes.
4. **Vercel environment variables:** set the Setup B column above. In particular, set
   `EMAIL_FROM` to an address on the verified domain, and **remove** `EMAIL_REMINDERS_FOR` and
   `EMAIL_DELIVER_TO`. Otherwise reminders still go to one person only.
5. Redeploy, then [test](#test-it) and [schedule](#schedule-the-hourly-run-supabase-pg_cron).
6. Check [Limits](#limits-to-know): the free Resend plan caps daily sends.

## Test it

Send yourself each email. They're marked `[Test]` and don't affect the real schedule. `to` is the
**Cram account** whose data the email is built from:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://cram-eta.vercel.app/api/cron/emails?test=weekly&to=you@example.com"
```

`test` can be `plan`, `weekly`, `comeback` or `streak_risk`. To see who would get what this hour
without sending anything, use `?dryRun=1`. Add `&at=2026-10-05T09:00:00Z` to pretend it's another
time.

Locally, `npm run dev` and open `/api/email/preview?kind=plan` (or `weekly`, `comeback`,
`streak_risk`) to see the designs with sample data.

## Schedule the hourly run (Supabase pg_cron)

Vercel's free plan only allows cron jobs once a day, so the hourly call comes from Supabase
(free). In Supabase → **SQL Editor**, run this with your real `CRON_SECRET`:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'cram-reminder-emails',
  '0 * * * *',  -- at the top of every hour
  $$
  select net.http_get(
    url := 'https://cram-eta.vercel.app/api/cron/emails',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET'),
    timeout_milliseconds := 60000
  );
  $$
);
```

Check it's running: `select * from cron.job_run_details order by start_time desc limit 5;` and the
responses: `select status_code, content from net._http_response order by created desc limit 5;`.

To pause all reminder emails: `select cron.unschedule('cram-reminder-emails');`

## Limits to know

- **Resend free plan:** 3,000 emails/month, 100/day. Each student gets at most two a day (morning
  plan + streak reminder) and usually far fewer, so roughly 50+ active students can hit the
  daily cap. Watch the Resend dashboard, or move to a paid plan, before opening it to everyone.
- **One run per hour, 60 seconds max.** Students are processed two at a time; that's comfortably
  enough for a few thousand accounts. Beyond that, move sending to Resend's batch API.
- A missed hour (e.g. a failed run) skips that hour's emails rather than sending them late.
