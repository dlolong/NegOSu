"use client";
import {useState} from "react";
import {Plus} from "lucide-react";
import {SearchableSelect} from "@/components/searchable-select";
import {InlineCreationGuard} from "@/components/inline-creation-guard";
import {FormActions} from "@/components/form-actions";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
// Some records (such as inventory products) store their category as text rather
// than referencing a separate category table. Confirm it in the enclosing draft.
export function SuggestedValueField({id,name,options,value,onValueChange,label,maxLength}:{id:string;name:string;options:string[];value:string;onValueChange:(value:string)=>void;label:string;maxLength:number}){
 const [added,setAdded]=useState<string[]>([]),[draft,setDraft]=useState<string|null>(null);
 return <div className="min-w-0"><SearchableSelect id={id} name={name} options={[...new Set([...options,...added])].map(value=>({id:value,name:value}))} value={value} onValueChange={onValueChange} createLabel={label.toLowerCase()} onCreate={setDraft} disabled={draft!==null} placeholder={`Search ${label.toLowerCase()} or add new`}/>{draft!==null?<InlineCreationGuard><section className="mt-3 rounded-xl border p-3"><p className="text-sm font-semibold">Use this new {label.toLowerCase()}?</p><p className="mt-1 text-xs text-slate-500">It will be saved with this record when you submit the form.</p><label className="mt-3 block text-sm">{label}<Input id={`${id}-new-name`} value={draft} maxLength={maxLength} onChange={event=>setDraft(event.target.value)}/></label><FormActions id={`${id}-new-actions`} className="mt-3" onCancel={()=>setDraft(null)}><Button id={`${id}-new-save`} type="button" disabled={draft.trim().length<2||draft.trim().length>maxLength} onClick={()=>{const next=draft.trim();setAdded(current=>[...current,next]);onValueChange(next);setDraft(null);}}><Plus size={16} aria-hidden="true"/>Use {label.toLowerCase()}</Button></FormActions></section></InlineCreationGuard>:null}</div>;
}
