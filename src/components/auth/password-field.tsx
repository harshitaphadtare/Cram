"use client";

import { useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { checkPassword, passwordScore } from "@/lib/password";
import { cn } from "@/lib/utils";

/** Password input with a show/hide toggle. */
export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("h-10 pr-10", className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

const SCORE_LABEL = ["", "Weak", "Fair", "Strong", "Very strong"];
const SCORE_COLOR = ["bg-muted-foreground/20", "bg-destructive", "bg-streak", "bg-chart-3", "bg-chart-3"];

/** Live strength meter and requirement checklist, shown under a new-password field. */
export function PasswordStrength({ password }: { password: string }) {
  const { results } = checkPassword(password);
  const score = passwordScore(password);

  return (
    <div className="flex flex-col gap-2.5" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="grid flex-1 grid-cols-4 gap-1">
          {[1, 2, 3, 4].map((step) => (
            <span
              key={step}
              className={cn(
                "h-1 rounded-full transition-colors duration-300",
                score >= step ? SCORE_COLOR[score] : "bg-muted-foreground/15",
              )}
            />
          ))}
        </div>
        <span className="w-20 text-right text-xs text-muted-foreground">{SCORE_LABEL[score]}</span>
      </div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {results.map((rule) => (
          <li
            key={rule.id}
            className={cn(
              "flex items-center gap-1.5 text-xs transition-colors duration-200",
              rule.passed ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "flex size-3.5 shrink-0 items-center justify-center rounded-full transition-all duration-200",
                rule.passed ? "scale-100 bg-chart-3 text-white" : "scale-90 border border-muted-foreground/40",
              )}
            >
              {rule.passed && <Check className="size-2.5" strokeWidth={3.5} />}
            </span>
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
