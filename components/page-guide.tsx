"use client";
import {useEffect,useEffectEvent,useRef,useState} from "react";
import {CircleHelp} from "lucide-react";
import type {Driver} from "driver.js";
import {Button} from "@/components/ui/button";
import {pageGuide,guideStorageKey,type PageGuide as Guide} from "@/lib/guides/tours";

export function PageGuide({pathname,membershipId,industry,role}:{pathname:string;membershipId:string;industry:string;role:string}) {
 const guide=pageGuide(pathname,industry);
 if(!guide)return null;
 const storageKey=guideStorageKey(membershipId,industry,role,guide.id);
 return <GuideControl key={`${storageKey}:${pathname}`} guide={guide} storageKey={storageKey}/>;
}
function GuideControl({guide,storageKey}:{guide:Guide;storageKey:string}) {
 const [loading,setLoading]=useState(false),[error,setError]=useState("");
 const instance=useRef<Driver|null>(null),alive=useRef(false),starting=useRef(false),button=useRef<HTMLButtonElement|null>(null);
 const checkFirstVisit=useEffectEvent(()=>{
  try{if(localStorage.getItem(storageKey))return true;}catch{return true;}
  if(starting.current||document.visibilityState!=="visible"||document.querySelector("dialog[open]")||document.activeElement?.matches("input,textarea,select"))return false;
  const ready=guide.steps.some(step=>Array.from(document.querySelectorAll<HTMLElement>(step.element)).some(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=="hidden"));
  if(!ready)return false;
  void start(true);
  return true;
 });
 useEffect(()=>{
  alive.current=true;
  const timer=window.setInterval(()=>{if(checkFirstVisit())clearInterval(timer);},900);
  const observer=new MutationObserver(()=>{if(document.querySelector("dialog[open]"))instance.current?.destroy();});
  observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:["open"]});
  return ()=>{alive.current=false;clearInterval(timer);observer.disconnect();instance.current?.destroy();instance.current=null;};
 },[storageKey]);
 function remember(status:string){try{localStorage.setItem(storageKey,status);}catch{/* Storage may be disabled. */}}
 async function start(automatic=false){
  if(starting.current||instance.current?.isActive())return;
  if(document.querySelector("dialog[open]")){if(!automatic)setError("Close the open popup, then start the guide.");return;}
  starting.current=true;setLoading(true);setError("");
  try{
   const {driver}=await import("driver.js");
   if(!alive.current)return;
   if(document.querySelector("dialog[open]")){if(!automatic)setError("Close the open popup, then start the guide.");return;}
   const steps=guide.steps.flatMap(step=>{
    const element=Array.from(document.querySelectorAll<HTMLElement>(step.element)).find(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=="hidden");
    return element?[{element,popover:{title:step.title,description:step.description}}]:[];
   });
   if(!steps.length){if(!automatic)setError("This guide is not available for the current page view.");return;}
   let completed=false;
   instance.current=driver({steps,animate:!matchMedia("(prefers-reduced-motion: reduce)").matches,smoothScroll:false,
    showProgress:true,progressText:"{{current}} of {{total}}",nextBtnText:"Next",prevBtnText:"Back",doneBtnText:"Done",
    popoverClass:"negosu-guide",disableActiveInteraction:true,allowKeyboardControl:true,
    onPopoverRender:popover=>{popover.closeButton.textContent="Skip";popover.closeButton.setAttribute("aria-label","Skip guide");},
    onDoneClick:()=>{completed=true;remember("completed");instance.current?.destroy();},
    // Driver may close before its first highlight animation sets the active step.
    // Persist dismissal before teardown, including an immediate Escape or Skip.
    onDestroyStarted:(_element,_step,{driver:activeDriver})=>{remember(completed?"completed":"dismissed");activeDriver.destroy();instance.current=null;button.current?.focus({preventScroll:true});},
    onDestroyed:()=>{if(alive.current){remember(completed?"completed":"dismissed");button.current?.focus({preventScroll:true});}instance.current=null;},
   });
   instance.current.drive();
   remember("started");
  }catch{if(alive.current)setError("The guide could not load. Please try again.");}
  finally{starting.current=false;if(alive.current)setLoading(false);}
 }
 return <div id="page-guide" className="relative shrink-0 print:hidden">
  <span ref={node=>{button.current=node?.querySelector("button")??null;}}><Button id="page-guide-start" variant="ghost" size="icon" className="rounded-full" disabled={loading} onClick={()=>start()} aria-label={loading?"Loading guide":guide.title} aria-busy={loading} title={guide.title}><CircleHelp size={18} aria-hidden="true" className={loading?"animate-pulse":undefined}/></Button></span>
  {error?<p role="status" className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-admin-border bg-admin-surface p-3 text-sm text-status-danger shadow-ui-md">{error}</p>:null}
 </div>;
}
