"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
export function PrintStatementButton() { return <Button id="hospitality-print-statement" className="print:hidden" onClick={() => window.print()}><Printer size={16}/>Print statement</Button>; }
