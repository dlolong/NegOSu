import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import {PageGuide} from "@/components/page-guide";
function Fixture(){
 const [away,setAway]=useState(false);
 return <><button id="navigate" onClick={()=>setAway(true)}>Leave page</button>{!away?<><PageGuide pathname="/dashboard/checkout/new" membershipId="test-member" industry="salon" role="owner"/><label htmlFor="checkout-customer-select">Customer<input id="checkout-customer-select"/></label><button id="product-new-sale-button" onClick={()=>{document.body.dataset.mutated="yes";}}>Choose products</button><button id="open-modal" onClick={()=>document.querySelector<HTMLDialogElement>("#edit-dialog")!.showModal()}>Open edit</button><dialog id="edit-dialog"><button onClick={()=>document.querySelector<HTMLDialogElement>("#edit-dialog")!.close()}>Close edit</button></dialog></>:<p>Another page</p>}</>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
