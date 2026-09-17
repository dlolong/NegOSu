"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { lookupRecords } from "@/app/dashboard/appointments/entity-actions";
import type { RecordKind } from "@/lib/record-lookup";

export type SelectOption = { id: string; name: string; keywords?: string; description?: string };
export function SearchableSelect({ id, name, options, value, defaultValue = "", onValueChange, placeholder = "Search and select…", required = false, disabled = false, lookup, scopeId, onCreate, createLabel = "record", preserveValueOnReset = false }: {
  preserveValueOnReset?: boolean; id: string; name?: string; options: SelectOption[]; value?: string; defaultValue?: string;
  onValueChange?: (value: string, option?: SelectOption) => void; placeholder?: string; required?: boolean; disabled?: boolean;
  lookup?: RecordKind; scopeId?: string; onCreate?: (name: string) => void; createLabel?: string;
}) {
  const [selected, setSelected] = useState(defaultValue), [query, setQuery] = useState("");
  const [open, setOpen] = useState(false), [active, setActive] = useState(-1);
  const [remote, setRemote] = useState<{ key: string; options: SelectOption[]; error?: string }>();
  const [chosen, setChosen] = useState<SelectOption>();
  const [above, setAbove] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const initial = useRef(value ?? defaultValue);
  const selectedId = value ?? selected;
  const selectedOption = options.find(option => option.id === selectedId) ?? (chosen?.id === selectedId ? chosen : undefined);
  const key = JSON.stringify([lookup, scopeId, query]);
  const loading = Boolean(open && lookup && remote?.key !== key);
  const error = remote?.key === key ? remote.error : undefined;
  const source = lookup && remote?.key === key && !error ? remote.options : options;
  const matches = lookup && remote?.key === key && !error ? source : source.filter(option => `${option.name} ${option.keywords ?? ""} ${option.description ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const visible = matches.slice(0, 50);
  const canCreate = onCreate && query.trim().length >= 2 && !loading && !error && !matches.some(option => option.name.trim().toLocaleLowerCase() === query.trim().toLocaleLowerCase());
  useEffect(() => {
    if (!open || !lookup) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void lookupRecords({ kind: lookup, query, scopeId }).then(result => {
        if (!cancelled) setRemote({ key, options: result.data ?? [], error: result.error });
      }).catch(() => { if (!cancelled) setRemote({ key, options: [], error: "Unable to search. Please try again." }); });
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, lookup, query, scopeId, key]);
  useEffect(() => {
    const form = input.current?.form;
    const reset = () => { if (preserveValueOnReset) { setQuery(""); setOpen(false); return; } setSelected(initial.current); setChosen(undefined); setQuery(""); setOpen(false); onValueChange?.(initial.current, options.find(option => option.id === initial.current)); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [onValueChange, options, preserveValueOnReset]);
  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${id}-option-${visible[active]?.id}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, id, visible]);
  useEffect(() => { input.current?.setCustomValidity(required && !selectedId ? "Select an existing record or save a new one." : ""); }, [required, selectedId]);
  function choose(option?: SelectOption) {
    setSelected(option?.id ?? ""); setChosen(option); onValueChange?.(option?.id ?? "", option); setOpen(false); setQuery(""); setActive(-1);
  }
  return <div data-record-ignore className="relative mt-2 min-w-0 text-sm font-normal" onClick={event => event.stopPropagation()} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setQuery(""); } }}>
    {name ? <input type="hidden" name={name} value={selectedId} disabled={disabled}/> : null}
    <div className="relative flex min-w-0 items-center">
      <input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-busy={loading} aria-controls={`${id}-options`} aria-activedescendant={open && active >= 0 && visible[active] ? `${id}-option-${visible[active].id}` : undefined} aria-describedby={error ? `${id}-error` : undefined} autoComplete="off" maxLength={160} aria-required={required} required={required && !selectedId} disabled={disabled} placeholder={selectedOption?.name ?? placeholder} value={open ? query : selectedOption?.name ?? ""}
        className="min-h-11 w-full min-w-0 rounded-xl border border-slate-300 bg-white py-2 pl-3 pr-16 text-admin-text focus:outline-none focus:ring-2 focus:ring-brand-primary/25 disabled:bg-slate-100"
        onFocus={() => { const rect=input.current?.getBoundingClientRect(); setAbove(Boolean(rect && window.innerHeight-rect.bottom<300 && rect.top>300)); setOpen(true); setQuery(""); }} onClick={() => setOpen(true)}
        onChange={event => { setQuery(event.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={event => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActive(current => Math.max(0, Math.min(visible.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)))); }
          if (event.key === "Enter" && open) { event.preventDefault(); if (visible[active]) choose(visible[active]); }
          if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); setQuery(""); }
        }}/>
      <div className="absolute right-2 flex items-center gap-1">{selectedId && !disabled ? <button id={`${id}-clear`} type="button" aria-label={`Clear ${selectedOption?.name ?? "selection"}`} className="flex min-h-9 min-w-9 items-center justify-center rounded-lg hover:bg-slate-100" onClick={() => choose()}><X size={16} aria-hidden="true"/></button> : null}<ChevronDown size={16} aria-hidden="true" className="pointer-events-none"/></div>
    </div>
    {open && !disabled ? <div className={`absolute inset-x-0 z-30 rounded-xl border border-slate-200 bg-white p-1 shadow-lg ${above ? "bottom-full mb-1" : "top-full mt-1"}`}>
      {loading ? <p role="status" className="p-3 text-slate-500">Searching…</p> : null}
      {error ? <p id={`${id}-error`} role="alert" className="p-3 text-status-danger">{error}</p> : null}
      <div id={`${id}-options`} role="listbox" aria-label="Matching records" className="max-h-56 overflow-y-auto">
        {visible.map((option, index) => <div id={`${id}-option-${option.id}`} key={option.id} role="option" aria-selected={option.id === selectedId} onMouseDown={event => event.preventDefault()} onClick={event => { event.preventDefault(); event.stopPropagation(); choose(option); }} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 [overflow-wrap:anywhere] ${index === active ? "bg-brand-tint" : "hover:bg-slate-50"}`}><span className="min-w-0 flex-1">{option.name}{option.description ? <span className="block text-xs text-slate-500">{option.description}</span> : null}</span>{option.id === selectedId ? <Check size={16} aria-hidden="true" className="shrink-0"/> : null}</div>)}
      </div>
      {!loading && !error && !visible.length ? <p role="status" className="p-3 text-slate-500">No matching records.</p> : null}
      {canCreate ? <button id={`${id}-create`} type="button" className="flex min-h-11 w-full items-center gap-2 rounded-lg p-3 text-left font-semibold text-brand-primary hover:bg-brand-tint [overflow-wrap:anywhere]" onClick={() => { onCreate(query.trim()); setOpen(false); }}><Plus size={16} aria-hidden="true" className="shrink-0"/><span>Add “{query.trim()}” as a new {createLabel}…</span></button> : null}
      {!lookup && matches.length > 50 ? <p className="p-2 text-xs text-slate-500">Type more to narrow these results.</p> : null}
    </div> : null}
  </div>;
}
