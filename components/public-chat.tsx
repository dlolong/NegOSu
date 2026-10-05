"use client";

import Link from "next/link";
import { CalendarDays, Clock3, List, MapPin, MessageCircle, Send, X, RotateCcw, ArrowRight, Mail, Phone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { customerChat } from "@/app/shop/[slug]/chat-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PublicShop } from "@/lib/public-booking";
import { formatMoney } from "@/lib/operations";
import { chatContactSchema, chatStorageKey, chatTokenSchema, customerMessageLength, type ChatSnapshot } from "@/modules/core/chat/contracts";

function newToken() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, "0")).join(""); }

export function PublicChat({ shop }: { shop: PublicShop }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const messageInput = useRef<HTMLTextAreaElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"help" | "message">("help");
  const [topic, setTopic] = useState<"services" | "hours" | "location">("services");
  const [questionSelected, setQuestionSelected] = useState(false);
  const [branchId, setBranchId] = useState(shop.branches[0]?.id ?? "");
  const [serviceId, setServiceId] = useState("");
  const [name, setName] = useState("");
  const [contactMethod, setContactMethod] = useState<"phone" | "email">("phone");
  const [contact, setContact] = useState("");
  const [contactReady, setContactReady] = useState(false);
  const [contactError, setContactError] = useState("");
  const [body, setBody] = useState("");
  const [token, setToken] = useState("");
  const draftToken = useRef("");
  const [restoring, setRestoring] = useState(false);
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
  const contactDetails = { customerName: name, customerPhone: contactMethod === "phone" ? contact.trim() : "", customerEmail: contactMethod === "email" ? contact.trim() : "" };

  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    element?.showModal();
    try {
      const saved = sessionStorage.getItem(chatStorageKey(shop.slug));
      if (chatTokenSchema.safeParse(saved).success) queueMicrotask(() => { setToken(saved!); setRestoring(true); setView("message"); });
    } catch { /* The open tab still works if browser storage is disabled. */ }
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
      finally { if (!cancelled && version === sequence.current) setRestoring(false); }
    }
    void read();
    const timer = setInterval(() => { void read(); }, 10_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [open, token, shop.slug]);

  useEffect(() => {
    const element = transcript.current;
    if (open && element && nearBottom.current) element.scrollTop = element.scrollHeight;
  }, [open, snapshot?.messages.length, topic, serviceId, questionSelected, view, contactReady, error]);

  function chooseTopic(value: typeof topic) {
    nearBottom.current = true;
    setQuestionSelected(true);
    setTopic(value);
  }
  function openMessages() {
    nearBottom.current = true;
    setView("message");
    requestAnimationFrame(() => { if (snapshot || contactReady) messageInput.current?.focus(); else nameInput.current?.focus(); });
  }
  function confirmContact(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = chatContactSchema.safeParse(contactDetails);
    if (!parsed.success) { setContactError(parsed.error.issues[0]?.message ?? "Enter a mobile number or email address."); return; }
    setContactError(""); setContactReady(true);
    requestAnimationFrame(() => messageInput.current?.focus());
  }
  function close() { setOpen(false); dialog.current?.close(); trigger.current?.focus(); }
  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || restoring || !branch || unavailable || snapshot && (snapshot.status !== "open" || snapshot.remaining <= 0)) return;
    if (!snapshot && !chatContactSchema.safeParse(contactDetails).success) { setContactReady(false); setContactError("Enter your name and a valid mobile number or email address."); return; }
    sending.current = true; setPending(true); setError("");
    const version = ++sequence.current;
    const value = token || draftToken.current || newToken();
    draftToken.current = value;
    if (!retry.current || retry.current.body !== body) retry.current = { body, requestId: crypto.randomUUID() };
    try {
      const result = await customerChat({ operation: snapshot ? "send" : "start", slug: shop.slug, token: value, body, requestId: retry.current.requestId, branchId, ...contactDetails });
      if (version !== sequence.current) return;
      if (result.data) {
        nearBottom.current = true; setSnapshot(result.data); setToken(value); setBody(""); retry.current = null;
        try { sessionStorage.setItem(chatStorageKey(shop.slug), value); } catch { /* Keep token in memory. */ }
      } else { setError(result.error ?? "Your message could not be sent."); if (result.unavailable) setUnavailable(true); }
    } catch { setError("Your message could not be sent. Please try again."); }
    finally { sending.current = false; setPending(false); requestAnimationFrame(() => messageInput.current?.focus()); }
  }
  function reset() {
    ++sequence.current; setToken(""); draftToken.current = ""; setSnapshot(null); setUnavailable(false); setRestoring(false); setError(""); setBody(""); retry.current = null;
    setName(""); setContact(""); setContactReady(false); setContactError("");
    try { sessionStorage.removeItem(chatStorageKey(shop.slug)); } catch { /* No stored conversation. */ }
    requestAnimationFrame(() => nameInput.current?.focus());
  }

  const topicLabels = { services: "What services do you offer?", hours: "When are you open?", location: "Where can I find you?" };
  const canMessage = (!snapshot || snapshot.status === "open" && snapshot.remaining > 0) && branch && !unavailable;
  const showComposer = view === "message" && canMessage && !restoring && (contactReady || snapshot);
  return <>
    <button ref={trigger} id="public-chat-open" type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-brand-primary px-5 font-medium text-white shadow-ui-md sm:bottom-6 sm:right-6"><MessageCircle size={20} aria-hidden="true"/>Chat</button>
    <dialog ref={dialog} id="public-chat-dialog" aria-labelledby="public-chat-title" onCancel={event => { event.preventDefault(); close(); }} className="m-auto h-[min(42rem,calc(100dvh-1rem))] max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-md overflow-hidden rounded-2xl border border-admin-border bg-white p-0 text-admin-text shadow-ui-md backdrop:bg-slate-950/40 sm:mb-4 sm:mr-4 [overflow-wrap:anywhere]">
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-admin-border bg-white p-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand-primary-strong" aria-hidden="true"><MessageCircle size={20}/></span>
          <div className="min-w-0 flex-1"><h2 id="public-chat-title" className="line-clamp-2 text-sm font-semibold">{shop.name}</h2><p className="mt-0.5 text-xs text-admin-text-secondary">Team replies when available</p></div>
          <Button id="public-chat-close" variant="ghost" size="icon" aria-label="Close chat" onClick={close}><X size={20} aria-hidden="true"/></Button>
        </header>
        <div className="flex shrink-0 gap-1 border-b border-admin-border px-3 py-2" aria-label="Chat views">
          <Button id="public-chat-help" variant="ghost" className={`flex-1 text-xs ${view === "help" ? "bg-brand-tint text-brand-primary-strong" : ""}`} aria-pressed={view === "help"} onClick={() => setView("help")}>Quick answers</Button>
          <Button id="public-chat-topic-message" variant="ghost" className={`flex-1 text-xs ${view === "message" ? "bg-brand-tint text-brand-primary-strong" : ""}`} aria-pressed={view === "message"} onClick={openMessages}>Message the team</Button>
        </div>
        <div ref={transcript} id="public-chat-transcript" onScroll={event => { const el=event.currentTarget; nearBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<80; }} className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-admin-surface-muted p-4">
          {view === "help" ? <>
            <div className="text-sm leading-relaxed"><h3 className="font-semibold">How can we help?</h3><p className="mt-1 text-admin-text-secondary">Choose a topic for a quick answer, or message our team.</p></div>
            <label className="flex items-center gap-2 text-xs text-admin-text-secondary"><MapPin size={16} aria-hidden="true"/><span>Location</span><select id="public-chat-branch" value={snapshot?.branchId ?? branchId} disabled={Boolean(snapshot) || pending} onChange={event => setBranchId(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-lg border border-admin-border bg-white px-2 text-sm">{shop.branches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <div id="public-chat-quick-options" aria-label="Quick questions" className="flex flex-wrap gap-2">{([
              ["services", "Services & prices", List], ["hours", "Opening hours", Clock3], ["location", "Location", MapPin],
            ] as const).map(([key, label, Icon]) => <Button key={key} id={`public-chat-topic-${key}`} variant="outline" className={`rounded-full bg-white text-xs ${questionSelected && topic===key ? "border-brand-primary text-brand-primary-strong" : ""}`} aria-pressed={questionSelected && topic===key} onClick={() => chooseTopic(key)}><Icon size={14} className="shrink-0" aria-hidden="true"/>{label}</Button>)}</div>
            {questionSelected ? <><div id="public-chat-selected-question" className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-tr-sm bg-brand-primary px-4 py-3 text-sm text-white"><span className="sr-only">You selected: </span>{topicLabels[topic]}</div>
            <section id="public-chat-answer" className="mr-4 rounded-2xl rounded-tl-sm border border-admin-border bg-white p-3 text-sm leading-relaxed" aria-live="polite">
          {topic === "services" ? <><p className="mb-3 font-medium">Choose a {shop.industry === "salon" ? "treatment" : "service"}</p>{shop.services.length ? <><select id="public-chat-service" aria-label="Service" value={serviceId} onChange={event => setServiceId(event.target.value)} className="min-h-11 w-full min-w-0 rounded-ui-md border border-admin-border bg-white px-2"><option value="">Browse services</option>{shop.services.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{service ? <p className="mt-3">{service.name} · From {formatMoney(service.priceCentavos, service.currency ?? shop.currency)} · {service.durationMinutes} minutes</p> : <p className="mt-2 text-admin-text-secondary">Select a service to see its starting price and duration.</p>}</> : <p>Services are not available for online booking yet. Contact the team for help.</p>}</> : null}
          {topic === "hours" ? <><p className="mb-2 font-medium">{branch?.name ?? "Opening hours"}</p>{branch && Object.keys(branch.hours ?? {}).length ? <dl className="space-y-2">{Object.entries(branch.hours ?? {}).map(([day, hours]) => <div key={day} className="flex justify-between gap-3"><dt className="capitalize">{day}</dt><dd>{hours?.closed ? "Closed" : hours?.open && hours?.close ? `${hours.open}–${hours.close}` : "Contact the team"}</dd></div>)}</dl> : <p>Opening hours have not been posted. Ask the team before visiting.</p>}</> : null}
          {topic === "location" ? <><p className="font-medium">{branch?.name ?? "Location"}</p><p className="mt-2">{branch?.address.filter(Boolean).join(", ") || "Ask the team for directions."}</p>{branch?.phone || shop.phone ? <a id="public-chat-call" className="mt-3 inline-flex min-h-11 items-center text-brand-primary-strong underline" href={`tel:${(branch?.phone || shop.phone)!.replace(/[^\d+]/g, "")}`}>Call the business</a> : null}</> : null}
            </section></> : null}
          </> : <>
            {restoring ? <p role="status" className="text-sm text-admin-text-secondary">Loading your conversation…</p> : null}
            {!snapshot && !restoring && canMessage ? <>
              {!contactReady ? <form id="public-chat-contact-form" onSubmit={confirmContact} className="space-y-4 rounded-2xl border border-admin-border bg-white p-4">
                <div><h3 className="font-semibold">Let’s get you connected</h3><p className="mt-1 text-sm leading-relaxed text-admin-text-secondary">Share your name and a mobile number or email so the team can follow up.</p></div>
                <label className="block text-sm font-medium" htmlFor="public-chat-name">Your name</label>
                <Input ref={nameInput} id="public-chat-name" required minLength={2} maxLength={80} placeholder="Your name" value={name} onChange={event => setName(event.target.value)} autoComplete="name"/>
                <fieldset><legend className="mb-2 text-sm font-medium">How can we reach you?</legend><div className="flex gap-2">{([['phone', 'Mobile number', Phone], ['email', 'Email address', Mail]] as const).map(([method, label, Icon]) => <label key={method} className={`flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-xl border px-2 text-xs ${contactMethod === method ? "border-brand-primary bg-brand-tint" : "border-admin-border"}`}><input id={`public-chat-contact-method-${method}`} type="radio" name="contactMethod" value={method} checked={contactMethod === method} onChange={() => {setContactMethod(method); setContact(""); setContactError("");}}/><Icon size={14} className="shrink-0" aria-hidden="true"/>{label}</label>)}</div></fieldset>
                <label htmlFor="public-chat-contact" className="sr-only">{contactMethod === "phone" ? "Mobile number" : "Email address"}</label>
                <Input id="public-chat-contact" type={contactMethod === "phone" ? "tel" : "email"} inputMode={contactMethod === "phone" ? "tel" : "email"} autoComplete={contactMethod === "phone" ? "tel" : "email"} required maxLength={contactMethod === "phone" ? 30 : 254} placeholder={contactMethod === "phone" ? "e.g. 0917 123 4567" : "you@example.com"} value={contact} onChange={event => setContact(event.target.value)} aria-invalid={Boolean(contactError)} aria-describedby="public-chat-contact-note"/>
                {shop.branches.length > 1 ? <label className="block text-sm font-medium">Location<select id="public-chat-contact-branch" value={branchId} onChange={event => setBranchId(event.target.value)} className="mt-2 min-h-11 w-full rounded-ui-md border border-admin-border bg-white px-2">{shop.branches.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : null}
                {contactError ? <p id="public-chat-contact-error" role="alert" className="text-sm text-status-danger">{contactError}</p> : null}
                <p id="public-chat-contact-note" className="text-xs leading-relaxed text-admin-text-secondary">Shared with {shop.name} when you send your first message. Replies appear here for seven days; keep this tab to check them.</p>
                <Button id="public-chat-contact-continue" type="submit" className="w-full">Continue to message<ArrowRight size={16} aria-hidden="true"/></Button>
              </form> : <div className="space-y-3 text-sm"><div className="rounded-2xl rounded-tl-sm border border-admin-border bg-white p-3"><p>Hi {name.trim()}, what can we help you with?</p><p className="mt-1 text-xs text-admin-text-secondary">Your message goes to {branch?.name}. The team will reply here when available.</p></div><div className="flex items-center justify-between gap-2 text-xs text-admin-text-secondary"><span className="min-w-0 break-all">{contact}</span><Button id="public-chat-edit-contact" variant="ghost" disabled={pending} className="shrink-0 text-xs" onClick={() => setContactReady(false)}>Edit details</Button></div></div>}
            </> : null}
            <section id="public-chat-messages" role="log" aria-live="polite" aria-relevant="additions" aria-label="Messages with the team" className="space-y-3">{snapshot?.messages.map(message => <article key={message.id} className={`w-fit max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.sender === "staff" ? "mr-auto rounded-tl-sm border border-admin-border bg-white" : "ml-auto rounded-tr-sm bg-brand-primary text-white"}`}><p className={`mb-1 text-xs font-medium ${message.sender === "staff" ? "text-admin-text-secondary" : "text-white/80"}`}>{message.sender === "staff" ? shop.name : "You"}</p><p className="whitespace-pre-wrap">{message.body}</p><time dateTime={message.createdAt} className={`mt-1 block text-right text-[11px] ${message.sender === "staff" ? "text-admin-text-secondary" : "text-white/80"}`}>{new Date(message.createdAt).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}</time></article>)}</section>
            {pending ? <p role="status" className="text-right text-xs text-admin-text-secondary">Sending…</p> : null}
            {error ? <p id="public-chat-error" role="alert" className="rounded-xl bg-status-warning-tint p-3 text-sm text-status-warning">{error}</p> : null}
            {!canMessage ? <p id="public-chat-limit-reached" className="rounded-xl bg-white p-3 text-sm text-admin-text-secondary">{!branch ? "Messaging is unavailable until the business adds a location." : unavailable ? "This conversation is no longer available." : snapshot?.status === "closed" ? "The team has closed this conversation." : "You have used your three messages."} You can still book or contact the business.</p> : null}
            {token && !canMessage ? <Button id="public-chat-reset" disabled={pending} variant="ghost" className="text-xs" onClick={reset}><RotateCcw size={14} aria-hidden="true"/>Start a new conversation</Button> : null}
          </>}
        </div>
        <footer className="shrink-0 space-y-2 border-t border-admin-border bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {showComposer ? <form id="public-chat-message-form" onSubmit={send}><fieldset disabled={pending} className="space-y-2">
            {!snapshot ? <div className="flex flex-wrap gap-2 [@media(max-height:550px)]:hidden" aria-label="Message suggestions">{[
              { id: "booking", label: "Booking help", text: service ? `I'd like to book ${service.name.slice(0, 160)}. Can you help?` : "I'd like to book an appointment. Can you help?" },
              { id: "service", label: "Service question", text: service ? `What should I know about ${service.name.slice(0, 160)}?` : "Can you help me choose the right service?" },
            ].map(suggestion => <Button key={suggestion.id} id={`public-chat-suggestion-${suggestion.id}`} variant="outline" className="rounded-full px-3 text-xs" onClick={() => {setBody(suggestion.text); messageInput.current?.focus();}}>{suggestion.label}</Button>)}</div> : null}
            <div className="flex items-end gap-2"><label className="min-w-0 flex-1"><span className="sr-only">Message</span><textarea ref={messageInput} id="public-chat-message" required maxLength={customerMessageLength} rows={2} placeholder="Write a message…" value={body} onChange={event => setBody(event.target.value)} aria-describedby="public-chat-message-limit" className="block max-h-28 min-h-11 w-full resize-none rounded-2xl border border-admin-border bg-admin-surface-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"/></label><Button id="public-chat-send" type="submit" size="icon" className="rounded-full" aria-label={pending ? "Sending message" : "Send message"} disabled={pending || !body.trim()}><Send size={18} aria-hidden="true"/></Button></div>
            <p id="public-chat-message-limit" className="text-[11px] text-admin-text-secondary">{body.length}/300 · {snapshot?.remaining ?? 3} messages left · Replies appear here</p>
          </fieldset></form> : null}
          {canBook ? <Button id="public-chat-book" asChild variant="ghost" className="w-full text-xs"><Link href={bookingHref}><CalendarDays size={16} aria-hidden="true"/>Book an appointment</Link></Button> : <p className="text-xs text-admin-text-secondary">Online booking is unavailable here. Use the website’s contact details.</p>}
        </footer>
      </div>
    </dialog>
  </>;
}
