"use client";
import { useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { PageHeader } from "@/components/page-patterns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecordTableSearchContext } from "@/components/record-table-search-context";

/** Payments uses the same tabs → toolbar → totals → table hierarchy as Reports. */
export function PaymentsLayout({ id, headerId, description, tabs, toolbar, summary, children, localSearch = false }: {
 id: string; headerId: string; description: string; tabs: ReactNode; toolbar: ReactNode; summary: ReactNode; children: ReactNode; localSearch?: boolean;
}) {
 const [open,setOpen]=useState(false), [search,setSearch]=useState("");
 function close() {setSearch("");setOpen(false);document.getElementById("payments-table-search-button")?.focus();}
 return <main id={id} className="mx-auto min-w-0 max-w-6xl">
  <PageHeader id={headerId} title="Payments" description={description}/>
  <RecordTableSearchContext.Provider value={search}>
   <div id="payments-workspace" className="mt-5 min-w-0">
    {tabs}
    <div id="payments-toolbar" className="my-3 flex min-w-0 flex-wrap items-center justify-end gap-2">
     {localSearch ? <>
      {open ? <div className="flex min-w-0 items-center gap-1"><Input id="payments-table-search-input" type="search" autoFocus aria-label="Search loaded payment records" placeholder="Search loaded records…" className="w-44 min-w-0 sm:w-60" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==="Escape"){e.preventDefault();close();}}}/><Button id="payments-table-search-close" size="icon" variant="ghost" aria-label="Clear and close search" onClick={close}><X size={16}/></Button></div> : null}
      <Button id="payments-table-search-button" size="icon" variant="secondary" aria-label="Search payments" title="Search loaded records" aria-expanded={open} aria-controls={open?"payments-table-search-input":undefined} className={open?"sr-only":undefined} onClick={()=>setOpen(true)}><Search size={16}/></Button>
     </> : null}
     {toolbar}
    </div>
    {summary}
    <div className="mt-4 min-w-0">{children}</div>
   </div>
  </RecordTableSearchContext.Provider>
 </main>;
}
