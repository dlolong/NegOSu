import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Input } from "@/components/ui/input";

function Fixture() {
  const [expiry, setExpiry] = useState("");
  const [submitted, setSubmitted] = useState("");
  const expiryRef = useRef<HTMLInputElement>(null);

  return <form id="date-time-form" className="grid gap-4 rounded-xl border bg-white p-4 sm:grid-cols-2" onSubmit={event => {
    event.preventDefault();
    setSubmitted(JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))));
  }} onReset={() => setExpiry("")}>
    <label>Date<Input id="test-date" name="date" type="date" required min="2026-01-01" max="2026-12-31" className="mt-2" aria-describedby="date-context"/></label>
    <label>Time<Input id="test-time" name="time" type="time" required min="09:00" max="17:00" step={900} className="mt-2"/></label>
    <label>Date and time<Input id="test-datetime" name="datetime" type="datetime-local" className="mt-2"/></label>
    <label>Existing appointment<Input id="test-existing" name="existing" type="datetime-local" defaultValue="2026-09-18T10:30" className="mt-2"/></label>
    <label>Expiry (optional)<Input id="test-expiry" ref={expiryRef} name="expiry" type="date" value={expiry} onChange={event => setExpiry(event.target.value)} placeholder="Choose an expiry date" className="mt-2"/></label>
    <label>Unavailable date<Input id="test-disabled" name="disabled" type="date" disabled className="mt-2"/></label>
    <label>Read-only date<Input id="test-readonly" name="readonly" type="date" readOnly defaultValue="2026-09-18" className="mt-2"/></label>
    <label>Month<Input id="test-month" name="month" type="month" className="mt-2"/></label>
    <label>Week<Input id="test-week" name="week" type="week" className="mt-2"/></label>
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-2 sm:col-span-2">
      <label>Opens<Input id="test-opens" type="time" defaultValue="09:00" className="mt-1 w-full sm:w-36"/></label>
      <label>Closes<Input id="test-closes" type="time" defaultValue="17:00" className="mt-1 w-full sm:w-36"/></label>
    </div>
    <span id="date-context">Choose a date in 2026.</span>
    <div className="flex flex-wrap gap-3 sm:col-span-2">
      <button id="date-time-submit" type="submit">Submit</button>
      <button id="date-time-reset" type="reset">Reset</button>
      <button id="date-time-focus" type="button" onClick={() => expiryRef.current?.focus()}>Focus expiry</button>
    </div>
    <output id="date-time-result" className="break-all sm:col-span-2">{submitted}</output>
  </form>;
}

createRoot(document.getElementById("root")!).render(<Fixture/>);
