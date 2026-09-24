/**
 * Password policy for new accounts, resets and password changes. Mirror these in Supabase
 * (Authentication → Providers → Email → password requirements) so the rule is also enforced
 * server-side, not just in the UI.
 */

export const MIN_PASSWORD_LENGTH = 10;

export interface PasswordRule {
  id: string;
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "length", label: `At least ${MIN_PASSWORD_LENGTH} characters`, test: (p) => p.length >= MIN_PASSWORD_LENGTH },
  { id: "lower", label: "A lowercase letter", test: (p) => /[a-z]/.test(p) },
  { id: "upper", label: "An uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { id: "number", label: "A number", test: (p) => /\d/.test(p) },
  { id: "symbol", label: "A symbol (e.g. ! ? # @)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function checkPassword(password: string) {
  const results = PASSWORD_RULES.map((rule) => ({ ...rule, passed: rule.test(password) }));
  const passedCount = results.filter((r) => r.passed).length;
  return { results, passedCount, isStrong: passedCount === PASSWORD_RULES.length };
}

/** 0–4 strength bucket for the meter: extra length beyond the minimum earns the top score. */
export function passwordScore(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  const { passedCount, isStrong } = checkPassword(password);
  if (isStrong) return password.length >= MIN_PASSWORD_LENGTH + 4 ? 4 : 3;
  if (passedCount >= 4) return 2;
  return 1;
}
