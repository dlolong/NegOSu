"use client";

import { useState, type ComponentProps } from "react";
import { createWalkIn } from "@/app/dashboard/operations-actions";
import { VisitForm } from "@/components/operations-forms";

/** Keep the draft mounted when the transaction rejects a selection. */
export function WalkInForm(props: Omit<ComponentProps<typeof VisitForm>, "mode" | "action">) {
  const [error, setError] = useState(props.error);
  // React resets forms after a resolved action, including a returned validation error.
  // Successful submissions navigate away; failed submissions must retain every field.
  return <div onResetCapture={event => { event.preventDefault(); event.stopPropagation(); }}><VisitForm {...props} mode="walk_in" error={error} action={async data => {
    setError(undefined);
    const result = await createWalkIn(data);
    setError(result.error);
  }}/></div>;
}
