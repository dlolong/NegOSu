import assert from "node:assert/strict";
import test from "node:test";
import { clientDetailTab, reminderReturnPath } from "../lib/client-detail-navigation";
test("client detail tabs default to history and respect explicit selections",()=>{
  assert.equal(clientDetailTab({}),"history");
  for(const tab of ["history","products","reminders"] as const) assert.equal(clientDetailTab({tab,productsPage:"2"}),tab);
  assert.equal(clientDetailTab({tab:"invalid",productsPage:"2"}),"history");
});
test("existing pagination and product search links open the relevant section",()=>{
  assert.equal(clientDetailTab({productsPage:"2"}),"products");
  assert.equal(clientDetailTab({q:"Cream"}),"products");
  assert.equal(clientDetailTab({from:"2026-10-01"}),"products");
  assert.equal(clientDetailTab({remindersPage:"2"}),"reminders");
});
test("reminder returns accept only the known origin and a valid client identity",()=>{
  const id="10000000-0000-4000-8000-000000000001";
  assert.equal(reminderReturnPath("client",id),`/dashboard/customers/${id}?tab=reminders`);
  for(const origin of [null,"//evil.test","/dashboard/customers","list"]) assert.equal(reminderReturnPath(origin,id),"/dashboard/customers/reminders");
  assert.equal(reminderReturnPath("client","../settings"),"/dashboard/customers/reminders");
});
