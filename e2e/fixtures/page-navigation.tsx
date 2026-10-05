import React from "react";
import { createRoot } from "react-dom/client";
import { PageHeader } from "@/components/page-patterns";
import { DashboardNavigationProvider } from "@/components/dashboard-back-link";
import { PageTitle } from "@/components/page-title";
import { Button } from "@/components/ui/button";
const query = new URLSearchParams(location.search);
createRoot(document.getElementById("root")!).render(<DashboardNavigationProvider salon industry="salon">
<nav id="test-tabs" aria-label="Sections">Overview · History</nav>
{query.has("legacy") ? <PageTitle id="legacy-title">Client details</PageTitle> : <PageHeader id="navigation-header" title="A long appointment title that needs to wrap on mobile" description="The description may take several lines, but navigation should appear above the tabs and title." back={query.has("custom") ? <Button id="custom-back">Back</Button> : undefined} close={<Button id="test-close" aria-label="Close page">Close</Button>} action={<Button id="test-save">Save changes</Button>}/>}
</DashboardNavigationProvider>);
