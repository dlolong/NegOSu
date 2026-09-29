"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { staffJobFunctionSuggestions } from "@/app/dashboard/settings/staff/staff-forms";

type Industry = keyof typeof staffJobFunctionSuggestions;

/** An explicit list cannot mix browser form-history suggestions across verticals. */
export function StaffJobFunctionField({ industry, prefix, initialValue = "" }: {
  industry: Industry; prefix: string; initialValue?: string;
}) {
  const suggestions: readonly string[] = staffJobFunctionSuggestions[industry];
  const [selection, setSelection] = useState(!initialValue || suggestions.includes(initialValue) ? initialValue : "custom");
  const [custom, setCustom] = useState(initialValue);
  return <div className="min-w-0">
    <label htmlFor={`${prefix}-job-function-input`} className="text-sm font-medium">Job function <span className="font-normal text-slate-500">(optional)</span></label>
    <select id={`${prefix}-job-function-input`} value={selection} onChange={event => setSelection(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3">
      <option value="">Not set</option>
      {suggestions.map(value => <option key={value} value={value}>{value}</option>)}
      <option value="custom">Other / custom title</option>
    </select>
    <input type="hidden" name="jobFunction" value={selection === "custom" ? custom : selection}/>
    {selection === "custom" ? <label className="mt-3 block text-sm" htmlFor={`${prefix}-job-function-custom`}>Custom job title
      <Input id={`${prefix}-job-function-custom`} value={custom} onChange={event => setCustom(event.target.value)} minLength={2} maxLength={80} required autoComplete="off" className="mt-2"/>
    </label> : null}
  </div>;
}
