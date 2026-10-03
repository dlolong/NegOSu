import React from "react";
import { createRoot } from "react-dom/client";
import { ServiceForm } from "@/components/operations-forms";
const salon = new URLSearchParams(location.search).has("salon");
createRoot(document.getElementById("root")!).render(<ServiceForm categories={[]} branches={[]} automotivePricing={!salon} serviceLabel={salon ? "Treatment" : "Service"} idPrefix={salon ? "salon-treatment" : "service"}/>);
