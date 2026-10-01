"use client";
import {Button} from "@/components/ui/button";
export function CheckoutPrintButton(){return <Button id="checkout-print-receipt" variant="secondary" className="print:hidden" onClick={()=>window.print()}>Print receipt / statement</Button>;}
