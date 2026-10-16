import { createRoot } from "react-dom/client";
import { CreditReports } from "@/components/reports/credit-reports";
import { RecordTable } from "@/components/record-table";
import { ImageUploadButton } from "@/components/image-upload-field";
const params = new URLSearchParams(location.search);
document.getElementById("root")!.className = "mx-auto max-w-7xl min-w-0 p-4";
createRoot(document.getElementById("root")!).render(params.has("image") ? <ImageUploadButton id="trial-image" onUploaded={() => {}}/> : <CreditReports actorId="test-actor" organizationId="81000000-0000-4000-8000-000000000001" paid={!params.has("free")} industry={params.get("industry") ?? "salon"} currency="PHP" branches={[{ id: "81000000-0000-4000-8000-000000000002", name: "Main" }]} range={{ start: "2026-10-01", end: "2026-10-15" }} categoryTables={Object.fromEntries(["bookings","payments","products","clients","services","staff","promos","rooms"].map(category=>[category,<RecordTable reportSearch key={category} id={`reports-${category}-table`} caption={`${category} · Last 7 days`} columns={[{key:"name",label:"Name"}]} rows={[{id:"sample",cells:{name:"Example record"}}]}/>]))}/>);
