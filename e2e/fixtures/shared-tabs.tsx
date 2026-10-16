import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Tabs, ViewTabs } from "@/components/ui/tabs";
function Fixture() {
 const [value,setValue]=useState("products");
 const items=["products","promos","clients","appointments","payments","services","staff"];
 return <div className="min-w-0 space-y-5"><Tabs id="route-tabs" ariaLabel="Catalog" items={items.map(item=>({id:`route-${item}`,label:item,href:`/dashboard/${item}`,active:item==="products"}))}/><ViewTabs id="view-tabs" ariaLabel="Report categories" value={value} onChange={setValue} items={items.map(item=>({id:`view-${item}`,value:item,label:item}))}/><p id="selected-view">{value}</p></div>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
