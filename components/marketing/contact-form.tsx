"use client";

import { useActionState, useRef, useState } from "react";
import { submitInquiry } from "@/app/contact/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { InquiryState } from "@/modules/platform/inquiries";

export function ContactForm() {
  const submitted = useRef(false);
  const requestId = useRef<string | null>(null);
  const [values, setValues] = useState({ name: "", email: "", subject: "", message: "" });
  const [state, action, pending] = useActionState<InquiryState, FormData>(async (previous, form) => {
    if (submitted.current) return { success: true };
    requestId.current ??= crypto.randomUUID();
    form.set("id", requestId.current);
    const result = await submitInquiry(previous, form);
    if (result.success) submitted.current = true;
    return result;
  }, {});
  function change(field: keyof typeof values, value: string) {
    requestId.current = null;
    setValues(current => ({ ...current, [field]: value }));
  }
  if (state.success) return <div id="contact-success" role="status" className="rounded-xl border border-brand-border bg-brand-tint p-6"><h2 className="text-xl font-medium">Thank you for your inquiry</h2><p className="mt-2">Your message has been sent to the NegOSu team. We can reach you at the email address you provided.</p></div>;
  return <form id="contact-form" action={action} className="space-y-4">
    <fieldset disabled={pending} className="space-y-4">
      <label className="block text-sm font-medium">Name<Input id="contact-name" name="name" required minLength={2} maxLength={120} autoComplete="name" value={values.name} onChange={e => change("name", e.target.value)}/></label>
      <label className="block text-sm font-medium">Email<Input id="contact-email" name="email" type="email" required maxLength={254} autoComplete="email" value={values.email} onChange={e => change("email", e.target.value)}/></label>
      <label className="block text-sm font-medium">Subject<Input id="contact-subject" name="subject" required minLength={3} maxLength={160} value={values.subject} onChange={e => change("subject", e.target.value)}/></label>
      <label className="block text-sm font-medium">Message<textarea id="contact-message" name="message" required minLength={10} maxLength={5000} rows={6} className="mt-1 w-full rounded-xl border border-admin-border p-3" value={values.message} onChange={e => change("message", e.target.value)}/></label>
      <div hidden aria-hidden="true"><label>Website<input id="contact-website" name="website" tabIndex={-1} autoComplete="off"/></label></div>
    </fieldset>
    {state.error ? <p id="contact-error" role="alert" className="text-sm text-status-danger">{state.error}</p> : null}
    <p className="text-xs text-zinc-500">Your contact details and message will be shared with the NegOSu team to handle your inquiry.</p>
    <Button id="contact-submit" type="submit" disabled={pending}>{pending ? "Sending…" : "Send inquiry"}</Button>
  </form>;
}
