"use client";
import {Printer} from "lucide-react";
import {Button} from "@/components/ui/button";
export function CheckoutPrintButton(){return <Button id="checkout-print-receipt" className="w-full sm:w-auto print:hidden" onClick={()=>window.print()}><Printer className="size-4 shrink-0" aria-hidden="true"/>Print receipt / statement</Button>;}
