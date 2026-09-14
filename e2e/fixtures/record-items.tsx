import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { RecordItem, RecordLink, RecordRow } from "@/components/record-item";
import { Button } from "@/components/ui/button";
import { ServiceCatalogList } from "@/components/service-catalog";

function Fixture() {
  const [deleted, setDeleted] = useState(0);
  const query = new URLSearchParams(location.search);
  const actions = <div className="ml-auto flex max-w-full flex-wrap justify-end gap-2"><Button asChild size="sm" variant="secondary"><Link id="record-edit" href="/records/one/edit"><Pencil aria-hidden="true" size={16}/>Edit</Link></Button><Button id="record-delete" size="sm" variant="outline" onClick={() => setDeleted(value => value + 1)}><Trash2 aria-hidden="true" size={16}/>Delete</Button></div>;
  const controls = <div data-record-ignore className="min-w-0 space-y-2"><label><input id="record-checkbox" type="checkbox"/> Select record</label><input id="record-note" aria-label="Note" className="w-full border"/><select id="record-select" aria-label="Status" className="w-full border"><option value="active">Active</option><option value="paused">Paused</option></select></div>;
  if (query.has("services")) return <ServiceCatalogList salon={false} canManage services={[{ id: "one", name: "Cleaning service", short_description: "A complete service", duration_minutes: 30, base_price_centavos: 50000, is_active: true, is_add_on: false, service_categories: { name: "Care" } }]}/>;
  return <><p id="deleted-count">Deleted: {deleted}</p>{query.has("card") ? <RecordItem id="record-card" className="rounded-xl border p-5"><h2><RecordLink id="record-primary" href="/records/one">Example item</RecordLink></h2><p id="record-description" className="py-5">Record description</p>{controls}{actions}</RecordItem> : <table className="w-full table-fixed"><thead><tr><th>Item</th><th>Details</th><th>Actions</th></tr></thead><tbody><RecordRow id="record-row"><td><RecordLink id="record-primary" href="/records/one">Example item</RecordLink></td><td id="record-description" className="p-5">Record description</td><td>{actions}</td></RecordRow></tbody></table>}</>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
