"use client";

import { useTransition, type ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

// Form actions and returned click-handler promises remain pending until React
// finishes their work. Existing SubmitButton supplies its own label and spinner.
export function PendingButton({ children, disabled, onClick, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  const [acting, startTransition] = useTransition();
  const busy = (props.type === "submit" && pending) || acting;
  const showSpinner = busy && !props["aria-busy"];

  return <button {...props} disabled={disabled || busy} aria-busy={props["aria-busy"] || busy}
    onClick={onClick ? event => startTransition(async () => { await onClick(event); }) : undefined}>
    {showSpinner ? <><span aria-hidden="true" className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent"/><span className="sr-only">Processing… </span></> : null}
    {children}
  </button>;
}
