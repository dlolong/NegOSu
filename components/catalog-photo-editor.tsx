"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { ServiceThumbnail } from "@/components/service-thumbnail";
import { ImageUploadButton } from "@/components/image-upload-field";
import { Button } from "@/components/ui/button";
import { businessLogoUrlSchema } from "@/modules/platform/business-branding";

/** No nested form: works both inside catalog forms and on detail pages. */
export function CatalogPhotoEditor({ id, url, name, subject = "service", onSave, saveLabel = "Use photo" }: {
  id: string; url?: string | null; name: string; subject?: "service" | "product" | "promo";
  onSave: (url: string) => Promise<{ error?: string } | void> | void; saveLabel?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const [open, setOpen] = useState(false), [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [open]);
  function close() {
    if (lock.current || uploading) return;
    setOpen(false);
    document.getElementById(`${id}-edit`)?.focus();
  }
  async function save() {
    if (lock.current || uploading) return;
    const parsed = businessLogoUrlSchema.safeParse(draft);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await onSave(parsed.data);
      if (result?.error) { setError(result.error); return; }
      setOpen(false);
      document.getElementById(`${id}-edit`)?.focus();
    } catch { setError("Unable to save the photo. Please try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="min-w-0">
    <div className="relative min-w-0">
      <ServiceThumbnail id={`${id}-preview`} url={url} name={name} subject={subject}/>
      <Button id={`${id}-edit`} type="button" size="sm" variant="secondary" className="absolute bottom-2 right-2 shadow-sm" onClick={() => { setDraft(url ?? ""); setError(""); setOpen(true); }}><Pencil size={14} aria-hidden="true"/>Edit photo</Button>
    </div>
    <dialog ref={dialog} id={`${id}-dialog`} aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); close(); }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-admin-border bg-white p-4 text-admin-text shadow-xl backdrop:bg-slate-950/45 sm:p-6" onKeyDown={event => {
      if (event.key === "Enter" && event.target instanceof HTMLInputElement && event.target.type === "url") { event.preventDefault(); void save(); }
    }}>
      {open ? <>
        <h2 id={`${id}-title`} className="text-lg font-semibold">Edit {subject} photo</h2>
        <p className="mt-1 text-sm text-admin-text-secondary">Upload a photo or paste a public image URL.</p>
        <div className="mx-auto my-4 w-40"><ServiceThumbnail id={`${id}-draft-preview`} url={draft} name={name} subject={subject}/></div>
        <label htmlFor={`${id}-url`} className="text-sm font-medium">Image URL</label>
        <input id={`${id}-url`} type="url" maxLength={2048} value={draft} disabled={busy || uploading} onChange={event => setDraft(event.target.value)} placeholder="https://example.com/photo.jpg" className="mt-1 min-h-11 w-full min-w-0 rounded-xl border border-admin-border px-3 text-sm"/>
        <ImageUploadButton id={`${id}-upload`} onUploaded={setDraft} onBusyChange={setUploading} disabled={busy}/>
        {error ? <p id={`${id}-error`} role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button id={`${id}-clear`} type="button" variant="ghost" disabled={busy || uploading || !draft} onClick={() => setDraft("")}>Clear photo</Button>
          <Button id={`${id}-cancel`} type="button" variant="secondary" disabled={busy || uploading} onClick={close}>Cancel</Button>
          <Button id={`${id}-save`} type="button" disabled={busy || uploading} onClick={() => void save()}>{busy ? "Saving…" : saveLabel}</Button>
        </div>
      </> : null}
    </dialog>
  </div>;
}
