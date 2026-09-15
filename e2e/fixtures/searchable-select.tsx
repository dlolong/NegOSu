import React from "react";
import {createRoot} from "react-dom/client";
import {RecordCard,RecordLink} from "@/components/record-item";
import {SearchableSelect} from "@/components/searchable-select";
const rows=Array.from({length:75},(_,index)=>({id:`row-${index}`,name:`Customer ${String(index).padStart(2,"0")}`}));
const remote=new URLSearchParams(location.search).has("remote");
function Fixture(){const [created,setCreated]=React.useState("");return <RecordCard id="test-card"><RecordLink href="https://forms.test/opened">Open record</RecordLink><form onSubmit={event=>{event.preventDefault();document.getElementById("result")!.textContent=JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)));}}><label htmlFor="record-choice">Customer</label><SearchableSelect id="record-choice" name="customerId" required options={rows} defaultValue="row-60" lookup={remote?"customer":undefined} onCreate={setCreated} createLabel="customer"/><button id="save" type="submit">Save</button><button id="reset" type="reset">Reset</button><p id="result"/><p id="created">{created}</p></form></RecordCard>;}
createRoot(document.getElementById("root")!).render(<Fixture/>);
