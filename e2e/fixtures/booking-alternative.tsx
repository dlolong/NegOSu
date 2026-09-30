import React from "react";
import {createRoot} from "react-dom/client";
import {BookingAlternativeResponse} from "@/components/booking-alternative-response";
createRoot(document.getElementById("root")!).render(<BookingAlternativeResponse token={"a".repeat(64)} timezone="Asia/Manila" offer={{version:2,startsAt:"2026-10-15T02:00:00Z",staffName:"Jamie",message:"Your requested stylist can see you at this time.",status:new URLSearchParams(location.search).has("accepted")?"accepted":"pending"}}/>);
