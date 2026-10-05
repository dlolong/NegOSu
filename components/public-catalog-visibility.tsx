import { ServiceThumbnail } from "@/components/service-thumbnail";
import { Eye, EyeOff } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";

export function PublicVisibilityItem({ id, name, visible, detail, action, fields, imageUrl, subject = "service" }: {
  id: string; name: string; visible: boolean; detail: string;
  action: (data: FormData) => Promise<void>; imageUrl?: string | null; subject?: "service" | "product" | "promo"; fields: Record<string,string>;
}) {
  const Icon = visible ? EyeOff : Eye;
  return <div id={`${id}-item`} className={`rounded-xl border p-4 ${visible ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-100"}`}>
    <form id={`${id}-form`} action={action} className="flex min-w-0 flex-wrap items-center justify-between gap-3">
      {Object.entries(fields).map(([key,value]) => <input key={key} type="hidden" name={key} value={value}/>)}
      <input type="hidden" name="isPublic" value={String(!visible)}/>
      <div className="w-24 shrink-0 sm:w-28"><ServiceThumbnail id={`${id}-thumbnail`} url={imageUrl} name={name} subject={subject}/></div>
      <div className="min-w-0 flex-1"><h3 className="text-sm font-medium text-slate-900 [overflow-wrap:anywhere]">{name}</h3><p className={`mt-1 text-xs font-medium ${visible ? "text-emerald-800" : "text-slate-600"}`}>{visible ? "Available to public" : "Hidden from public"}</p><p className="mt-1 text-xs text-slate-600">{detail}</p></div>
      <SubmitButton id={`${id}-toggle-button`} pendingText="Updating…" variant={visible ? "publicHide" : "publicShow"}><Icon size={16} aria-hidden="true"/>{visible ? "Hide" : "Show"}<span className="sr-only"> {name} on public page</span></SubmitButton>
    </form>
  </div>;
}
