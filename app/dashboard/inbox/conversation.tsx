"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, Send, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { manageChat } from "./actions";

export function InboxRefresh() {
  const router = useRouter();
  useEffect(() => { const timer = setInterval(() => { if (!document.hidden) router.refresh(); }, 15_000); return () => clearInterval(timer); }, [router]);
  return <Button id="inbox-refresh" variant="secondary" onClick={() => router.refresh()}><RefreshCw size={16} aria-hidden="true"/>Refresh</Button>;
}

export function ConversationActions({ id, status, expired }: { id: string; status: string; expired: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const retry = useRef<{ body: string; requestId: string } | null>(null);
  async function submit(operation: "reply" | "close" | "reopen") {
    if (busy.current) return;
    busy.current = true; setPending(true); setError("");
    if (!retry.current || retry.current.body !== body) retry.current = { body, requestId: crypto.randomUUID() };
    try {
      const result = await manageChat({ id, operation, body, requestId: retry.current.requestId });
      if (result.error) setError(result.error);
      else { if (operation === "reply") { setBody(""); retry.current = null; } router.refresh(); }
    } catch { setError("Your change could not be saved. Please try again."); }
    finally { busy.current = false; setPending(false); }
  }
  return <div className="mt-5 border-t border-admin-border pt-4">
    {error ? <p id="inbox-action-error" role="alert" className="mb-3 text-sm text-status-danger">{error}</p> : null}
    {expired ? <p className="text-sm text-admin-text-secondary">This conversation has expired. Replies are no longer available.</p> : <>
      {status === "open" ? <form id="inbox-reply-form" onSubmit={event => { event.preventDefault(); void submit("reply"); }}><label className="block text-sm font-medium">Reply<textarea id="inbox-reply" required maxLength={1000} disabled={pending} value={body} onChange={event => setBody(event.target.value)} className="mt-2 min-h-28 w-full rounded-ui-md border border-admin-border p-3"/></label><p className="mt-2 text-xs text-admin-text-secondary">The customer sees your reply in their chat. No email or SMS is sent.</p><div className="mt-4 flex flex-wrap justify-end gap-2"><Button id="inbox-close-conversation" variant="secondary" disabled={pending} onClick={() => { void submit("close"); }}><Check size={16} aria-hidden="true"/>Close conversation</Button><Button id="inbox-send-reply" type="submit" disabled={pending || !body.trim()}><Send size={16} aria-hidden="true"/>{pending ? "Saving…" : "Send reply"}</Button></div></form> : <div className="flex justify-end"><Button id="inbox-reopen-conversation" disabled={pending} onClick={() => { void submit("reopen"); }}><RotateCcw size={16} aria-hidden="true"/>Reopen conversation</Button></div>}
    </>}
  </div>;
}
