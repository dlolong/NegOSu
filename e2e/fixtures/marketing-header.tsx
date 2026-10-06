import React from "react";
import { createRoot } from "react-dom/client";
import { MarketingHeader } from "@/components/marketing/marketing-header";

createRoot(document.getElementById("root")!).render(<>
  <MarketingHeader/>
  <section id="header-test-content" style={{ minHeight: 2200, paddingTop: 80 }}>
    <button id="header-test-outside">Outside header</button>
    <div id="features" style={{ marginTop: 700 }}>Features</div>
  </section>
</>);
