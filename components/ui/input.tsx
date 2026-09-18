import { forwardRef, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const dateTimeHints: Record<string, string> = {
  date: "Select a date",
  time: "Select a time",
  "datetime-local": "Select a date and time",
  month: "Select a month",
  week: "Select a week",
};

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  const hint = dateTimeHints[props.type ?? ""];
  const hintId = hint && props.id ? `${props.id}-hint` : undefined;
  const input = <input ref={ref} className={cn("min-h-11 w-full min-w-0 max-w-full rounded-ui-md border border-admin-border-strong bg-admin-surface px-3 py-2 text-admin-text shadow-ui-sm placeholder:text-slate-400 focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 aria-invalid:border-status-danger aria-invalid:ring-status-danger/20", className)} {...props} aria-describedby={cn(props["aria-describedby"], hintId) || undefined} />;
  if (!hint) return input;

  // Native date/time pickers ignore placeholders. Keep a visible, associated
  // hint without replacing the picker or relying on JavaScript/value selectors.
  return <span className="date-time-field block min-w-0 max-w-full">
    {input}
    <span id={hintId} aria-hidden={hintId ? true : undefined} className="mt-1 block text-xs font-normal text-admin-text-muted">{props.placeholder || hint}</span>
  </span>;
});
