import assert from "node:assert/strict";
import test from "node:test";
import { listHref } from "../lib/list-navigation";

test("changing list tabs preserves search and branch/date filters but resets pagination",()=>{
  const url=new URL(listHref("/dashboard/appointments",{q:"A & B",date:"2026-09-15",status:"confirmed",page:"3"},{view:"week",page:undefined}),"http://local.test");
  assert.equal(url.pathname,"/dashboard/appointments");assert.equal(url.searchParams.get("q"),"A & B");assert.equal(url.searchParams.get("date"),"2026-09-15");assert.equal(url.searchParams.get("status"),"confirmed");assert.equal(url.searchParams.get("view"),"week");assert.equal(url.searchParams.has("page"),false);
});
test("list tabs discard dialogs, selected records, notices and invitation tokens",()=>{
  const url=listHref("/dashboard/settings/staff",{tab:"directory",dialog:"access",staffId:"selected",invite:"private-token",message:"Saved",error:"Error",create:"1",edit:"selected"},{tab:"invitations"});
  assert.equal(url,"/dashboard/settings/staff?tab=invitations");
});
test("All clears a status filter and an empty query produces the canonical route",()=>{
  assert.equal(listHref("/dashboard/bookings",{status:"confirmed"},{status:undefined}),"/dashboard/bookings");
  assert.equal(listHref("/dashboard/jobs",{status:"queued",q:""},{status:""}),"/dashboard/jobs");
});
