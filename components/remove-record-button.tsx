"use client";
import {useActionState,useId,useRef} from "react";
import {Trash2} from "lucide-react";
import {removeRecord} from "@/app/dashboard/records/actions";
import {Button} from "@/components/ui/button";
import {SubmitButton} from "@/components/submit-button";
export function RemoveRecordButton({kind,recordId,name}:{kind:"product"|"promo"|"staff"|"room"|"service"|"resource";recordId:string;name:string}) {
 const [state,action,pending]=useActionState(removeRecord,{});
 const dialog=useRef<HTMLDialogElement>(null);
 const unique=useId().replaceAll(":",""); const id=`remove-${kind}-${recordId}-${unique}`;
 return <div className="mt-6 min-w-0 border-t border-admin-border pt-4 text-left" data-record-ignore>
  {!state.message?<Button id={`${id}-open`} variant="danger" size="sm" onClick={()=>dialog.current?.showModal()} aria-haspopup="dialog" aria-controls={`${id}-confirmation`}><Trash2 size={15} aria-hidden="true"/>Remove<span className="sr-only"> {name}</span></Button>:null}
  <dialog ref={dialog} id={`${id}-confirmation`} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} aria-busy={pending}
   onCancel={event=>{event.stopPropagation();if(pending)event.preventDefault();}}
   onClose={event=>event.stopPropagation()}
   className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto overscroll-contain rounded-xl border border-admin-border bg-admin-surface p-5 text-admin-text shadow-ui-md backdrop:bg-slate-950/50 sm:p-6">
   <h2 id={`${id}-title`} className="text-lg font-semibold [overflow-wrap:anywhere]">Remove {name}?</h2>
   <div id={`${id}-description`} className="mt-3 space-y-2 text-sm text-admin-text-secondary"><p>Unused records will be deleted. Records with history or linked items will be archived and unavailable for new selections.</p>{kind==="staff"?<p>Archiving also disables linked sign-in access and pending invitations.</p>:null}</div>
   {state.error?<p role="alert" className="mt-3 text-sm text-status-danger">{state.error}</p>:null}
   <form action={action} className="mt-5 flex flex-wrap justify-end gap-3 border-t border-admin-border pt-4">
    <input type="hidden" name="kind" value={kind}/><input type="hidden" name="id" value={recordId}/>
    <Button id={`${id}-cancel`} variant="secondary" autoFocus disabled={pending} onClick={()=>dialog.current?.close()}>Cancel</Button>
    <SubmitButton id={`${id}-confirm`} variant="danger" pendingText="Removing…">Confirm removal</SubmitButton>
   </form>
  </dialog>
  {state.message?<p role="status" className="mt-2 text-sm text-status-success">{state.message}</p>:null}
 </div>;
}
