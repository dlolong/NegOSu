"use client";
import { useActionState, type ReactNode } from "react";
export type HospitalityActionState = { error?: string };
export function HospitalityActionForm({ id, action, children }: { id: string; action: (previous: HospitalityActionState, data: FormData) => Promise<HospitalityActionState>; children: ReactNode }) {
  const [state, formAction] = useActionState(action, {});
  return <form id={id} action={formAction} className="grid min-w-0 gap-4 sm:grid-cols-2">{state.error ? <p id={`${id}-error`} role="alert" className="col-span-full rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{state.error}</p> : null}{children}</form>;
}
