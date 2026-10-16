import { useState } from "react";
import { createRoot } from "react-dom/client";
import { LookupScopeProvider } from "@/components/lookup-scope";
import { SearchableSelect, type SelectOption } from "@/components/searchable-select";
function Fixture() {
 const [scope,setScope]=useState("user:org:branch:owner");
 const [options,setOptions]=useState<SelectOption[]>([]);
 return <LookupScopeProvider key={scope} scope={scope}>
 <SearchableSelect id="lookup" options={options} lookup="customer"/>
 <button id="outside">Close</button>
 <button id="change-scope" onClick={()=>setScope("user:other-org:branch:owner")}>Switch business</button>
 <button id="new-options" onClick={()=>setOptions([{id:"created",name:"New customer"}])}>Create customer</button>
 </LookupScopeProvider>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
