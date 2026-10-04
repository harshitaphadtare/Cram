/**
 * Reminder email templates: plain inline-styled HTML (what email clients reliably render) plus a
 * text version. Kept deliberately quiet, like the app: one heading, a few lines, one button.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

interface Footer {
  unsubscribeUrl: string;
  settingsUrl: string;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function formatMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const C = {
  text: "#37352f",
  muted: "#787774",
  faint: "#9b9a97",
  border: "#e9e9e7",
  bg: "#f7f7f5",
  accent: "#2383e2",
  streak: "#f97316",
};

function layout(opts: {
  preheader: string;
  heading: string;
  body: string;
  cta: { label: string; url: string };
  footer: Footer;
}): string {
  const { preheader, heading, body, cta, footer } = opts;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${esc(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${C.text};">
<tr><td style="padding:0 4px 16px;font-size:13px;font-weight:700;letter-spacing:0.18em;color:${C.text};">CRAM</td></tr>
<tr><td style="background:#ffffff;border:1px solid ${C.border};border-radius:12px;padding:32px 32px 28px;">
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:600;color:${C.text};">${esc(heading)}</h1>
${body}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr><td style="border-radius:8px;background:${C.accent};">
<a href="${esc(cta.url)}" style="display:inline-block;padding:11px 20px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${esc(cta.label)}</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:20px 4px 0;font-size:12px;line-height:1.6;color:${C.faint};">
You're getting this because it's turned on in your Cram settings.
<a href="${esc(footer.unsubscribeUrl)}" style="color:${C.faint};text-decoration:underline;">Unsubscribe</a> ·
<a href="${esc(footer.settingsUrl)}" style="color:${C.faint};text-decoration:underline;">Email settings</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

const p = (html: string) =>
  `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${C.text};">${html}</p>`;

/** A short list of pages/tasks, e.g. "Types of Requirements · System Design". */
function list(items: { title: string; meta?: string }[], more: number): string {
  const rows = items
    .map(
      (i) => `<tr><td style="padding:9px 0;border-top:1px solid ${C.border};font-size:14px;color:${C.text};">${esc(i.title)}${
        i.meta ? ` <span style="color:${C.faint};">· ${esc(i.meta)}</span>` : ""
      }</td></tr>`,
    )
    .join("");
  const tail = more > 0
    ? `<tr><td style="padding:9px 0;border-top:1px solid ${C.border};font-size:13px;color:${C.muted};">and ${more} more</td></tr>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">${rows}${tail}</table>`;
}

/** A row of small stat tiles for the weekly recap. */
function stats(items: { label: string; value: string }[]): string {
  const cells = items
    .map(
      (s) => `<td style="padding:12px;border:1px solid ${C.border};border-radius:8px;" width="${Math.floor(100 / items.length)}%">
<div style="font-size:18px;font-weight:600;color:${C.text};">${esc(s.value)}</div>
<div style="font-size:12px;color:${C.muted};margin-top:2px;">${esc(s.label)}</div></td>`,
    )
    .join(`<td width="8"></td>`);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0 8px;"><tr>${cells}</tr></table>`;
}

const hi = (name: string | null) => (name ? `Hi ${esc(name)},` : "Hi,");

// ---------- The emails ----------

export function streakRiskEmail(d: {
  name: string | null;
  streak: number;
  /** A banked freeze would cover today if they skip it. */
  freezeCovers: boolean;
  url: string;
  footer: Footer;
}): RenderedEmail {
  const heading = d.freezeCovers
    ? `Keep your ${d.streak}-day streak going`
    : `Your ${d.streak}-day streak ends at midnight`;
  const subject = heading;
  const line2 = d.freezeCovers
    ? "A streak freeze will cover today if you can't make it, but it's your last line of defence. Five minutes now keeps it in your pocket."
    : "You haven't studied yet today. Five minutes of notes, one focus session or a quick quiz is all it takes to keep it alive.";
  const html = layout({
    preheader: d.freezeCovers ? "Five minutes keeps your freeze for a rainy day." : "Five minutes is enough to keep it.",
    heading,
    body: `${p(hi(d.name))}${p(line2)}`,
    cta: { label: "Study for 5 minutes", url: d.url },
    footer: d.footer,
  });
  const text = [
    hi(d.name),
    "",
    heading,
    "",
    line2,
    "",
    `Study now: ${d.url}`,
    "",
    `Unsubscribe: ${d.footer.unsubscribeUrl}`,
  ].join("\n");
  return { subject, html, text };
}

export function planEmail(d: {
  name: string | null;
  reviews: { title: string; folder: string }[];
  reviewCount: number;
  tasks: { title: string; overdue: boolean }[];
  taskCount: number;
  /** How many of `taskCount` are due today (the rest are overdue). */
  tasksDueToday: number;
  url: string;
  footer: Footer;
}): RenderedEmail {
  const r = d.reviewCount;
  const t = d.taskCount;
  const tasks = d.tasksDueToday ? `${plural(d.tasksDueToday, "task")} due` : plural(t, "overdue task");
  const subject =
    r && t
      ? `Today: ${tasks} and ${plural(r, "page")} to review`
      : r
        ? `${plural(r, "page is", "pages are")} ready for review`
        : `Today: ${tasks}`;
  const heading = r && !t ? "Time for a quick review" : "Your plan for today";

  let body = p(hi(d.name));
  if (r) {
    body += p(
      `${plural(r, "page is", "pages are")} at the point where ${r === 1 ? "it starts" : "they start"} to fade from memory. A short quiz now locks ${r === 1 ? "it" : "them"} in for longer.`,
    );
    body += list(d.reviews.map((x) => ({ title: x.title, meta: x.folder })), r - d.reviews.length);
  }
  if (t) {
    body += p(`<span style="display:block;margin-top:${r ? 16 : 0}px;">${r ? "Also on your list:" : "Due today:"}</span>`);
    body += list(d.tasks.map((x) => ({ title: x.title, meta: x.overdue ? "overdue" : undefined })), t - d.tasks.length);
  }

  const html = layout({
    preheader: r ? "A few minutes now saves re-learning it later." : "Here's what's due today.",
    heading,
    body,
    cta: { label: r ? "Start review" : "Open planner", url: d.url },
    footer: d.footer,
  });
  const text = [
    hi(d.name),
    "",
    heading,
    ...(r ? ["", "Ready for review:", ...d.reviews.map((x) => `- ${x.title} (${x.folder})`)] : []),
    ...(t ? ["", "Due today:", ...d.tasks.map((x) => `- ${x.title}${x.overdue ? " (overdue)" : ""}`)] : []),
    "",
    d.url,
    "",
    `Unsubscribe: ${d.footer.unsubscribeUrl}`,
  ].join("\n");
  return { subject, html, text };
}

export function comebackEmail(d: {
  name: string | null;
  /** Days since they last studied (or since sign-up, if they never have). */
  daysAway: number;
  neverStudied: boolean;
  longestStreak: number;
  reviewCount: number;
  url: string;
  footer: Footer;
}): RenderedEmail {
  let subject: string;
  let heading: string;
  let lines: string[];
  if (d.neverStudied) {
    subject = d.daysAway <= 1 ? "Write your first note in Cram" : "Your study space is ready";
    heading = d.daysAway <= 1 ? "Start with one page" : "Your study space is ready";
    lines = [
      "Make a folder for a subject, write (or paste) your notes, and Cram turns them into quizzes, reminders and a streak.",
      "Five minutes is enough to start your first streak.",
    ];
  } else if (d.daysAway <= 2) {
    subject = "Pick up where you left off";
    heading = "Pick up where you left off";
    lines = [
      d.longestStreak > 1
        ? `Your streak reset, but your best is still ${plural(d.longestStreak, "day")}. One short session today starts the next one.`
        : "One short session today starts a new streak.",
    ];
  } else if (d.daysAway <= 7) {
    subject = "A quick 10-minute review?";
    heading = "A quick 10-minute review?";
    lines = [
      d.reviewCount
        ? `${plural(d.reviewCount, "page is", "pages are")} due for review, and memories fade fastest in the first couple of weeks. A short quiz brings them back.`
        : "Memories fade fastest in the first couple of weeks. A short quiz on what you've written brings it back.",
    ];
  } else {
    subject = "Your notes are still here";
    heading = "Your notes are still here";
    lines = [
      "Whenever you're ready, everything is where you left it. A quick quiz is the fastest way back in.",
      "This is the last nudge we'll send until you're back. You can turn reminders off below.",
    ];
  }
  const html = layout({
    preheader: lines[0],
    heading,
    body: p(hi(d.name)) + lines.map(p).join(""),
    cta: { label: d.neverStudied ? "Open Cram" : d.reviewCount ? "Start review" : "Open Cram", url: d.url },
    footer: d.footer,
  });
  const text = [hi(d.name), "", heading, "", ...lines, "", d.url, "", `Unsubscribe: ${d.footer.unsubscribeUrl}`].join("\n");
  return { subject, html, text };
}

export function weeklyEmail(d: {
  name: string | null;
  minutes: number;
  daysStudied: number;
  xp: number;
  streak: number;
  level: number;
  levelTitle: string;
  achievements: string[];
  reviewsComingUp: number;
  url: string;
  footer: Footer;
}): RenderedEmail {
  const subject = `Your week: ${formatMinutes(d.minutes)} studied over ${plural(d.daysStudied, "day")}`;
  const heading = "Your week in Cram";
  let body = p(hi(d.name));
  body += p(
    d.daysStudied >= 5
      ? "That was a strong week. Here's how it went."
      : "Here's how your week went. Every day you showed up counts.",
  );
  body += stats([
    { label: "studied", value: formatMinutes(d.minutes) },
    { label: d.daysStudied === 1 ? "day" : "days", value: String(d.daysStudied) },
    { label: "XP earned", value: `+${d.xp}` },
  ]);
  const extras: string[] = [];
  if (d.streak > 0) extras.push(`You're on a <b>${d.streak}-day</b> streak.`);
  extras.push(`Level ${d.level} · ${esc(d.levelTitle)}.`);
  if (d.achievements.length) extras.push(`Unlocked: ${d.achievements.map((a) => `<b>${esc(a)}</b>`).join(", ")}.`);
  if (d.reviewsComingUp) extras.push(`${plural(d.reviewsComingUp, "page")} will be ready for review this week.`);
  body += p(extras.join(" "));

  const html = layout({
    preheader: `${formatMinutes(d.minutes)} studied, +${d.xp} XP.`,
    heading,
    body,
    cta: { label: "Plan next week", url: d.url },
    footer: d.footer,
  });
  const text = [
    hi(d.name),
    "",
    heading,
    `Studied: ${formatMinutes(d.minutes)} over ${plural(d.daysStudied, "day")}`,
    `XP earned: +${d.xp}`,
    d.streak > 0 ? `Streak: ${d.streak}-day` : "",
    `Level ${d.level} · ${d.levelTitle}`,
    d.achievements.length ? `Unlocked: ${d.achievements.join(", ")}` : "",
    "",
    d.url,
    "",
    `Unsubscribe: ${d.footer.unsubscribeUrl}`,
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");
  return { subject, html, text };
}
