# Reminder emails

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

How it works: a scheduler calls `GET /api/cron/emails` once an hour. The route
(`src/app/api/cron/emails/route.ts`) runs `runReminders` (`src/lib/email/reminders.ts`), which
works out each student's local hour and decides what, if anything, they get. Every send is
recorded in the `email_logs` table first, so overlapping runs can't double-send.

## Setup

### 1. Resend: verify a domain

Resend's shared test sender (`onboarding@resend.dev`) only delivers to the email address your
Resend account was created with. To email students you need a domain you own (a `.vercel.app`
address can't be verified):

1. Buy a domain (e.g. from Cloudflare, Namecheap or Porkbun), or use one you have.
2. Resend → **Domains → Add domain**. Using a subdomain such as `mail.yourdomain.com` keeps
   reminder mail separate from anything else on the domain.
3. Add the DNS records Resend shows (SPF, DKIM, and the recommended DMARC record) at your domain
   provider, then click **Verify**.

### 2. Vercel: environment variables

Vercel → your project → **Settings → Environment Variables** (Production), then redeploy:

| Variable | Value |
| --- | --- |
| `RESEND_API_KEY` | Resend → API Keys (already set if signup alerts work) |
| `EMAIL_FROM` | e.g. `Cram <reminders@mail.yourdomain.com>` (on the verified domain) |
| `CRON_SECRET` | A long random string. Use the one in your local `.env`. It authorises the hourly call and signs unsubscribe links, so don't change it casually: old unsubscribe links stop working. |
| `APP_URL` | Optional. Links in emails point here. Defaults to `https://cram-eta.vercel.app`. |

### 3. Try it on yourself

With the variables set and deployed, send yourself each email (they're marked `[Test]` and don't
affect the real schedule):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://cram-eta.vercel.app/api/cron/emails?test=weekly&to=you@example.com"
```

`test` can be `plan`, `weekly`, `comeback` or `streak_risk`. To see who would get what this hour
without sending anything, use `?dryRun=1`. Add `&at=2026-10-05T09:00:00Z` to pretend it's another
time.

Locally, `npm run dev` and open `/api/email/preview?kind=plan` (or `weekly`, `comeback`,
`streak_risk`) to see the designs with sample data.

### 4. Schedule the hourly run (Supabase pg_cron)

Vercel's free plan only allows cron jobs once a day, so the hourly call comes from Supabase.
In Supabase → **SQL Editor**, run this with your real `CRON_SECRET`:

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
  plan + streak reminder) and usually far fewer. Watch the Resend dashboard as Cram grows.
- **One run per hour, 60 seconds max.** Students are processed two at a time; that's comfortably
  enough for a few thousand accounts. Beyond that, move sending to Resend's batch API.
- A missed hour (e.g. a failed run) skips that hour's emails rather than sending them late.
