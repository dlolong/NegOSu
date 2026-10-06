"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ServiceThumbnail } from "@/components/service-thumbnail";
import Link from "next/link";
import { MAX_IMAGE_BYTES } from "@/modules/platform/image-upload";

export function ImageUploadButton({ id, onUploaded, onBusyChange, disabled = false }: { id: string; onUploaded: (url: string) => void; onBusyChange?: (busy: boolean) => void; disabled?: boolean }) {
  const [access, setAccess] = useState<{ allowed: boolean; owner: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const lock = useRef(false);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const form = container.current?.closest("form");
    const guard = (event: Event) => { if (lock.current) { event.preventDefault(); event.stopPropagation(); } };
    form?.addEventListener("submit", guard, true);
    return () => form?.removeEventListener("submit", guard, true);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/dashboard/images", { signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok) {
        if (!controller.signal.aborted) setError(typeof result.error === "string" ? result.error : "Upload availability could not be checked. Refresh to retry.");
        return;
      }
      setAccess(result);
    }).catch(() => { if (!controller.signal.aborted) setError("Upload availability could not be checked. Refresh to retry."); });
    return () => controller.abort();
  }, []);
  async function upload(file: File | undefined) {
    if (!file || lock.current || disabled) return;
    setSuccess(false); setError("");
    if (file.size > MAX_IMAGE_BYTES || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Choose a JPG, PNG or WebP up to 2 MB."); return; }
    lock.current = true; setBusy(true); onBusyChange?.(true);
    try {
      const data = new FormData(); data.set("image", file);
      const response = await fetch("/api/dashboard/images", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "Upload failed. Try again."); if (result.upgrade) setAccess(current => current ? { ...current, allowed: false } : null); return; }
      onUploaded(result.url); setSuccess(true);
    } catch { setError("Upload could not be confirmed. Check your connection and try again."); }
    finally { lock.current = false; setBusy(false); onBusyChange?.(false); }
  }
  return <div ref={container} id={id} className="mt-3 space-y-2 text-xs">
    {access?.allowed ? <><label htmlFor={`${id}-file`} className="block font-medium">Upload a photo</label><input id={`${id}-file`} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || disabled} className="block w-full min-w-0 rounded-lg border border-admin-border p-2" onChange={event => { void upload(event.target.files?.[0]); event.target.value = ""; }}/><p className="text-admin-text-muted">JPG, PNG or WebP · Up to 2 MB. Uploaded images are public.</p></> : access ? <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-border bg-brand-tint p-3"><p className="min-w-0 flex-1 text-sm leading-snug">Image uploads require a paid plan.</p>{access.owner ? <Button asChild size="lg" className="w-full shrink-0 sm:w-auto sm:min-w-40"><Link id={`${id}-upgrade`} href="/dashboard/settings/billing">Upgrade plan</Link></Button> : <p className="text-sm">Ask the owner to upgrade.</p>}</div> : !error ? <p role="status">Checking upload availability…</p> : null}
    {busy ? <p role="status">Uploading… Wait for the preview before saving.</p> : null}
    {success ? <p role="status">Uploaded. Save this form to use the photo.</p> : null}
    {error ? <p id={`${id}-error`} role="alert" className="text-red-700">{error}</p> : null}
  </div>;
}

export function ImageUploadField({ id, name, label, value = "", required = false }: { id: string; name: string; label: string; value?: string | null; required?: boolean }) {
  const [url, setUrl] = useState(value ?? "");
  return <div className="min-w-0"><label htmlFor={id} className="text-sm font-medium">{label}</label><input id={id} name={name} type="url" maxLength={2048} value={url} onChange={event => setUrl(event.target.value)} required={required} className="mt-2 min-h-11 w-full rounded-xl border border-admin-border px-3 text-sm" placeholder="Upload a photo or paste an image URL"/><ImageUploadButton id={`${id}-upload`} onUploaded={setUrl}/>{url ? <div className="mt-3 max-w-xs"><ServiceThumbnail id={`${id}-preview`} url={url} name={label}/></div> : null}</div>;
}
