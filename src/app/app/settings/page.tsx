import { requireUser } from "@/lib/auth";
import { SettingsForm } from "@/components/settings-form";
import { StudyPreferences } from "@/components/study-preferences";
import { AccountActions } from "@/components/account-actions";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div className="cram-stagger mx-auto flex w-full max-w-xl flex-col gap-6 pb-16">
      <div>
        <h1 className="text-3xl font-semibold">Account</h1>
        <p className="text-muted-foreground">Manage your profile, security, and preferences.</p>
      </div>

      <StudyPreferences
        dailyGoalMin={user.dailyGoalMin}
        showOnLeaderboard={user.showOnLeaderboard}
      />

      <SettingsForm
        user={{
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl,
          timezone: user.timezone,
        }}
      />

      {/* Log out and the destructive reset sit last. */}
      <AccountActions />
    </div>
  );
}
