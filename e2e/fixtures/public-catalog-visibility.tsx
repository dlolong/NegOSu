import React from "react";
import { createRoot } from "react-dom/client";
import { PublicVisibilityItem } from "@/components/public-catalog-visibility";
createRoot(document.getElementById("root")!).render(<div className="grid gap-3">{[true,false].map(visible=><PublicVisibilityItem key={String(visible)} id={visible ? "shown" : "hidden"} name={visible ? "Public product" : "Hidden promo"} visible={visible} detail="Main Branch" fields={{id:"item"}} action={async data=>{document.body.dataset.visibility=String(data.get("isPublic"));}}/>)}</div>);
