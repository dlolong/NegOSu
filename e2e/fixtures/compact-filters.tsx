import { createRoot } from "react-dom/client";
import { CompactFilters } from "@/components/compact-filters";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const query = new URLSearchParams(location.search);
const mode = query.get("mode") ?? "combined";
createRoot(document.getElementById("root")!).render(<>
  <CompactFilters id="records-filters" searchLabel="Search customers" searchValue={query.get("q") ?? ""}
    search={mode === "filters" ? undefined : <Input id="records-search" name="q" type="search" defaultValue={query.get("q") ?? ""} placeholder="Customer name"/>}
    hasFilters={mode !== "search"}
    hiddenFields={<><input type="hidden" name="tab" value="history"/><input type="hidden" name="mode" value={mode}/></>}>
    {mode !== "search" ? <>
      <label>Status<select id="records-status" name="status" defaultValue={query.get("status") ?? "active"} className="block min-h-11 w-full rounded-md border px-3"><option value="active">Active</option><option value="archived">Archived</option></select></label>
      <label>From<Input id="records-start" type="date" name="start" max="2026-12-31" defaultValue={query.get("start") ?? "2026-09-01"}/></label>
      <Button id="records-apply" type="submit">Apply filters</Button>
    </> : null}
  </CompactFilters>
  <section id="records-results" className="mt-4 rounded-xl border p-4">Results stay here while the filters are open.</section>
</>);
