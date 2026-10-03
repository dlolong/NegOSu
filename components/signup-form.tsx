"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useFormStatus } from "react-dom";

import { BusinessTypeSelector } from "@/components/business-type-selector";
import { PasswordFields } from "@/components/password-fields";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signUpSchema } from "@/lib/auth/schemas";
import type { PublicProductKey } from "@/modules/platform/product-entry";

const steps = [
  { label: "Business", title: "Choose your business", fields: ["industry"] },
  { label: "Your details", title: "Tell us about yourself", fields: ["firstName", "lastName", "email"] },
  { label: "Password", title: "Secure your account", fields: ["password", "confirmPassword"] },
];

function Navigation({ step, back }: { step: number; back: () => void }) {
  const { pending } = useFormStatus();
  return <div className="flex gap-3 pt-2">
    {step > 0 ? <Button id="negosu-signup-back-button" variant="secondary" disabled={pending} onClick={back}>Back</Button> : null}
    <SubmitButton id={step === 2 ? "negosu-signup-submit-button" : "negosu-signup-continue-button"} className="flex-1" pendingText="Creating account…">
      {step === 2 ? "Create account" : "Continue"}
    </SubmitButton>
  </div>;
}

export function SignupForm({ action, initialIndustry }: { action: (data: FormData) => Promise<void>; initialIndustry?: PublicProductKey }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);
  const submitting = useRef(false);

  useEffect(() => {
    if (moved.current) heading.current?.focus();
  }, [step]);

  function move(next: number) {
    moved.current = true;
    setError("");
    setStep(next);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    if (submitting.current) { event.preventDefault(); return; }
    const form = event.currentTarget;
    const result = signUpSchema.safeParse(Object.fromEntries(new FormData(form)));
    const issue = result.success ? undefined : result.error.issues.find(item => step === 2 || steps[step].fields.includes(String(item.path[0])));
    if (issue) {
      event.preventDefault();
      const field = String(issue.path[0]);
      const targetStep = steps.findIndex(item => item.fields.includes(field));
      if (targetStep >= 0 && targetStep !== step) move(targetStep);
      setError(issue.message);
      const input = form.querySelector<HTMLInputElement>(`input[name="${field}"]`);
      if (targetStep === step) input?.focus();
      return;
    }
    if (step < 2) { event.preventDefault(); move(step + 1); }
    else { setError(""); submitting.current = true; }
  }

  return <form id="negosu-signup-form" action={async data => {
    try { await action(data); } finally { submitting.current = false; }
  }} noValidate onSubmit={submit} className="mt-6 space-y-5">
    <ol id="negosu-signup-progress" aria-label="Signup progress" className="grid grid-cols-3 gap-2">
      {steps.map((item, index) => <li key={item.label} aria-current={step === index ? "step" : undefined} className={`border-t-2 pt-2 text-xs ${index <= step ? "border-brand-primary font-medium text-brand-primary-strong" : "border-slate-200 text-slate-500"}`}>
        <span className="block">Step {index + 1}</span><span>{item.label}</span>
      </li>)}
    </ol>
    <h2 id="negosu-signup-step-title" ref={heading} tabIndex={-1} className="text-base font-medium focus:outline-none">{steps[step].title}</h2>
    {error ? <p id="negosu-signup-step-error" role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
    <div hidden={step !== 0}>
      <BusinessTypeSelector idPrefix="negosu" initialIndustry={initialIndustry} />
    </div>
    <div hidden={step !== 1} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium" htmlFor="negosu-signup-first-name-input">First name<Input id="negosu-signup-first-name-input" required maxLength={60} autoComplete="given-name" name="firstName" className="mt-2" /></label>
        <label className="block text-sm font-medium" htmlFor="negosu-signup-last-name-input">Last name<Input id="negosu-signup-last-name-input" required maxLength={60} autoComplete="family-name" name="lastName" className="mt-2" /></label>
      </div>
      <label className="block text-sm font-medium" htmlFor="negosu-signup-email-input">Email address<Input id="negosu-signup-email-input" required autoComplete="email" name="email" type="email" inputMode="email" className="mt-2" /></label>
    </div>
    <div hidden={step !== 2} className="space-y-4">
      <PasswordFields idPrefix="negosu-signup" />
      <p className="text-xs leading-5 text-zinc-500">After creating your account, you’ll continue to email verification or business setup.</p>
    </div>
    <Navigation step={step} back={() => move(step - 1)} />
  </form>;
}
