"use client";

import Link from "next/link";
import { CalendarDays, Clock3, List, MapPin, MessageCircle, Send, X, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { customerChat } from "@/app/shop/[slug]/chat-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PublicShop } from "@/lib/public-booking";
import { formatMoney } from "@/lib/operations";
import { chatStorageKey, chatTokenSchema, customerMessageLength, type ChatSnapshot } from "@/modules/core/chat/contracts";

function newToken() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, "0")).join(""); }

export function PublicChat({ shop }: { shop: PublicShop }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<"services" | "hours" | "location" | "message">("services");
  const [branchId, setBranchId] = useState(shop.branches[0]?.id ?? "");
  const [serviceId, setServiceId] = useState("");
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [token, setToken] = useState("");
  const [snapshot, setSnapshot] = useState<ChatSnapshot | null>(null);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [pending, setPending] = useState(false);
  const sending = useRef(false);
  const sequence = useRef(0);
  const retry = useRef<{ body: string; requestId: string } | null>(null);
  const branch = shop.branches.find(item => item.id === (snapshot?.branchId ?? branchId));
  const service = shop.services.find(item => item.id === serviceId);
  const canBook = Boolean(branch?.acceptsBookings && shop.services.length);
  const query = new URLSearchParams({ branch: branch?.id ?? "" });
  if (service) query.set("service", service.id);
  const bookingHref = `/shop/${encodeURIComponent(shop.slug)}/book?${query}`;

  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    element?.showModal();
    try { const saved = sessionStorage.getItem(chatStorageKey(shop.slug)); if (chatTokenSchema.safeParse(saved).success) queueMicrotask(() => setToken(saved!)); } catch { /* The open tab still works if browser storage is disabled. */ }
    return () => element?.close();
  }, [open, shop.slug]);

  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    async function read() {
      if (sending.current || document.hidden) return;
      const version = ++sequence.current;
      try {
        const result = await customerChat({ operation: "read", slug: shop.slug, token });
        if (cancelled || version !== sequence.current) return;
        if (result.data) { setSnapshot(result.data); setUnavailable(false); setError(""); }
        else { setError(result.error ?? "Chat could not be loaded."); if (result.unavailable) setUnavailable(true); }
      } catch { if (!cancelled && version === sequence.current) setError("Replies could not be refreshed. Please try again shortly."); }
    }
    void read();
    const timer = setInterval(() => { void read(); }, 10_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [open, token, shop.slug]);

  function close() { setOpen(false); dialog.current?.close(); trigger.current?.focus(); }
  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    sending.current = true; setPending(true); setError("");
    const version = ++sequence.current;
    const value = token || newToken();
    setToken(value);
    try { sessionStorage.setItem(chatStorageKey(shop.slug), value); } catch { /* Keep token in memory. */ }
    if (!retry.current || retry.current.body !== body) retry.current = { body, requestId: crypto.randomUUID() };
    try {
      const result = await customerChat({ operation: snapshot ? "send" : "start", slug: shop.slug, token: value, body, requestId: retry.current.requestId, branchId, customerName: name });
      if (version !== sequence.current) return;
      if (result.data) { setSnapshot(result.data); setBody(""); retry.current = null; }
      else { setError(result.error ?? "Your message could not be sent."); if (result.unavailable) setUnavailable(true); }
    } catch { setError("Your message could not be sent. Please try again."); }
    finally { sending.current = false; setPending(false); }
  }
  function reset() {
    ++sequence.current; setToken(""); setSnapshot(null); setUnavailable(false); setError(""); setBody(""); retry.current = null;
    try { sessionStorage.removeItem(chatStorageKey(shop.slug)); } catch { /* No stored conversation. */ }
  }

  return <>
    <button ref={trigger} id="public-chat-open" type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-primary px-5 font-medium text-white shadow-ui-md sm:bottom-6 sm:right-6"><MessageCircle size={20} aria-hidden="true"/>Chat</button>
    <dialog ref={dialog} id="public-chat-dialog" aria-labelledby="public-chat-title" onCancel={event => { event.preventDefault(); close(); }} className="m-auto max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-lg overflow-hidden rounded-ui-lg border border-admin-border bg-white p-0 text-admin-text shadow-ui-md backdrop:bg-slate-950/40 [overflow-wrap:anywhere]">
      <div className="flex max-h-[calc(100dvh-1rem)] flex-col">
      <header className="shrink-0 flex items-center justify-between gap-3 border-b border-admin-border bg-white p-4"><div className="min-w-0"><h2 id="public-chat-title" className="font-medium">Chat with {shop.name}</h2><p className="mt-1 text-xs text-admin-text-secondary">Quick answers, business replies, easy booking</p></div><Button id="public-chat-close" variant="ghost" size="icon" aria-label="Close chat" onClick={close}><X size={20} aria-hidden="true"/></Button></header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <p className="rounded-ui-lg bg-admin-surface-muted p-3 text-sm">Hi! Choose an option below, or leave a short message for the team. Ready to visit? Choose a service and book a time.</p>
        <label className="block text-sm font-medium">Location<select id="public-chat-branch" value={snapshot?.branchId ?? branchId} disabled={Boolean(snapshot) || pending} onChange={event => setBranchId(event.target.value)} className="mt-2 min-h-11 w-full min-w-0 rounded-ui-md border border-admin-border bg-white px-3">{shop.branches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <div id="public-chat-quick-options" className="grid grid-cols-2 gap-2">{([
          ["services", "Services & prices", List], ["hours", "Opening hours", Clock3], ["location", "Location", MapPin], ["message", "Message the team", MessageCircle],
        ] as const).map(([key, label, Icon]) => <Button key={key} id={`public-chat-topic-${key}`} variant={topic === key ? "primary" : "secondary"} aria-pressed={topic === key} onClick={() => setTopic(key)}><Icon size={16} className="shrink-0" aria-hidden="true"/>{label}</Button>)}</div>
        <section id="public-chat-answer" className="rounded-ui-lg border border-admin-border p-3 text-sm" aria-live="polite">
          {topic === "services" ? <><p className="mb-3 font-medium">Choose a {shop.industry === "salon" ? "treatment" : "service"}</p>{shop.services.length ? <><select id="public-chat-service" aria-label="Service" value={serviceId} onChange={event => setServiceId(event.target.value)} className="min-h-11 w-full min-w-0 rounded-ui-md border border-admin-border bg-white px-2"><option value="">Browse services</option>{shop.services.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{service ? <p className="mt-3">{service.name} · From {formatMoney(service.priceCentavos, service.currency ?? shop.currency)} · {service.durationMinutes} minutes</p> : <p className="mt-2 text-admin-text-secondary">Select a service to see its starting price and duration.</p>}</> : <p>Services are not available for online booking yet. Contact the team for help.</p>}</> : null}
          {topic === "hours" ? <><p className="mb-2 font-medium">{branch?.name ?? "Opening hours"}</p>{branch && Object.keys(branch.hours ?? {}).length ? <dl className="space-y-2">{Object.entries(branch.hours ?? {}).map(([day, hours]) => <div key={day} className="flex justify-between gap-3"><dt className="capitalize">{day}</dt><dd>{hours?.closed ? "Closed" : hours?.open && hours?.close ? `${hours.open}–${hours.close}` : "Contact the team"}</dd></div>)}</dl> : <p>Opening hours have not been posted. Ask the team before visiting.</p>}</> : null}
          {topic === "location" ? <><p className="font-medium">{branch?.name ?? "Location"}</p><p className="mt-2">{branch?.address.filter(Boolean).join(", ") || "Ask the team for directions."}</p>{branch?.phone || shop.phone ? <a id="public-chat-call" className="mt-3 inline-flex min-h-11 items-center text-brand-primary-strong underline" href={`tel:${(branch?.phone || shop.phone)!.replace(/[^\d+]/g, "")}`}>Call the business</a> : null}</> : null}
          {topic === "message" ? <p>Send up to three messages of 300 characters each. The team replies here when available. Keep this tab to check replies; conversations expire after seven days.</p> : null}
        </section>
        {snapshot?.messages.length ? <section id="public-chat-messages" aria-label="Conversation" className="space-y-3">{snapshot.messages.map(message => <article key={message.id} className={`rounded-ui-lg p-3 text-sm ${message.sender === "staff" ? "mr-6 bg-brand-tint" : "ml-6 bg-admin-surface-muted"}`}><p className="mb-1 text-xs font-medium">{message.sender === "staff" ? shop.name : "You"}</p><p className="whitespace-pre-wrap">{message.body}</p></article>)}</section> : null}
        {error ? <p id="public-chat-error" role="alert" className="rounded-ui-md bg-status-warning-tint p-3 text-sm text-status-warning">{error}</p> : null}
        {topic === "message" ? <>{(!snapshot || snapshot.status === "open" && snapshot.remaining > 0) && branch && !unavailable ? <form id="public-chat-message-form" onSubmit={send} className="space-y-3"><fieldset disabled={pending} className="space-y-3">{!snapshot ? <label className="block text-sm font-medium">Your name<Input id="public-chat-name" required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} autoComplete="name" className="mt-2"/></label> : null}<div className="flex flex-wrap gap-2" aria-label="Message suggestions">{[
          { id: "booking", label: "Booking help", text: service ? `I'd like to book ${service.name.slice(0, 160)}. Can you help?` : "I'd like to book an appointment. Can you help?" },
          { id: "service", label: "Service question", text: service ? `What should I know about ${service.name.slice(0, 160)}?` : "Can you help me choose the right service?" },
        ].map(suggestion => <Button key={suggestion.id} id={`public-chat-suggestion-${suggestion.id}`} variant="secondary" onClick={() => setBody(suggestion.text)}><MessageCircle size={14} aria-hidden="true"/>{suggestion.label}</Button>)}</div><label className="block text-sm font-medium">Message<textarea id="public-chat-message" required maxLength={customerMessageLength} value={body} onChange={event => setBody(event.target.value)} className="mt-2 min-h-24 w-full rounded-ui-md border border-admin-border p-3"/></label><p id="public-chat-message-limit" className="text-xs text-admin-text-secondary">{body.length}/300 characters · {snapshot?.remaining ?? 3} messages left</p><div className="flex justify-end"><Button id="public-chat-send" type="submit" disabled={pending || !body.trim()}><Send size={16} aria-hidden="true"/>{pending ? "Sending…" : "Send message"}</Button></div></fieldset></form> : <p id="public-chat-limit-reached" className="text-sm text-admin-text-secondary">{!branch ? "Messaging is unavailable until the business adds a location." : unavailable ? "This conversation is no longer available." : snapshot?.status === "closed" ? "The team has closed this conversation." : "You have used your three messages."} Use the available booking or contact options below.</p>}{token ? <Button id="public-chat-reset" disabled={pending} variant="ghost" onClick={reset}><RotateCcw size={16} aria-hidden="true"/>Start a new conversation</Button> : null}</> : null}
      </div>
        <div className="shrink-0 border-t border-admin-border bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{canBook ? <Button id="public-chat-book" asChild className="w-full"><Link href={bookingHref}><CalendarDays size={18} aria-hidden="true"/>Book an appointment</Link></Button> : <p className="text-sm text-admin-text-secondary">Online booking is unavailable for this location. Message the team or use the website’s contact details.</p>}<p className="mt-2 text-xs text-admin-text-secondary">The business confirms your appointment after you submit a booking request.</p></div>
      </div>
    </dialog>
  </>;
}
