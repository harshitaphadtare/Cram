import { comebackEmail, planEmail, streakRiskEmail, weeklyEmail } from "@/lib/email/templates";

/**
 * Development only: renders each reminder email with sample data, to check the design in a
 * browser — /api/email/preview?kind=plan (streak_risk | plan | comeback | weekly).
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const kind = new URL(request.url).searchParams.get("kind") ?? "plan";
  const footer = { unsubscribeUrl: "#", settingsUrl: "#" };
  const url = "#";

  const email =
    kind === "streak_risk"
      ? streakRiskEmail({ name: "Harshita", streak: 12, freezeCovers: false, url, footer })
      : kind === "comeback"
        ? comebackEmail({ name: "Harshita", daysAway: 7, neverStudied: false, longestStreak: 12, reviewCount: 4, url, footer })
        : kind === "weekly"
          ? weeklyEmail({
              name: "Harshita", minutes: 412, daysStudied: 5, xp: 486, streak: 12, level: 4, levelTitle: "Learner",
              achievements: ["Quiz regular", "On fire"], reviewsComingUp: 6, url, footer,
            })
          : planEmail({
              name: "Harshita",
              reviews: [
                { title: "Types of Requirements", folder: "System Design & Architecture" },
                { title: "Components of system design", folder: "System Design & Architecture" },
                { title: "Frameworks, Controls and Compliance", folder: "Cybersecurity" },
              ],
              reviewCount: 3,
              tasks: [{ title: "Finish lab 4 write-up", overdue: false }, { title: "Revise subnetting", overdue: true }],
              taskCount: 2,
              tasksDueToday: 1,
              url,
              footer,
            });

  return new Response(`<!-- Subject: ${email.subject} -->\n${email.html}`, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
