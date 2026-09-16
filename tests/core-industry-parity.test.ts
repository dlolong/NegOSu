import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { supportedVerticalKeys } from "../modules/platform/brand";
import { resolveIndustryConfig } from "../modules/platform/industry";
import { navigationForIndustry } from "../modules/platform/navigation";
import { readAllFinancialRows, summarizePayments, type LedgerPayment, type PaymentDocument } from "../modules/core/payments/payment-workspace";
import { csvCell } from "../lib/reporting";

for (const industry of supportedVerticalKeys) {
  test(`${industry} exposes every shared operational capability with role boundaries`, () => {
    const config = resolveIndustryConfig(industry);
    for (const capability of (industry === "hospitality" ? ["inventory", "payments", "reports"] : ["appointments", "inventory", "payments", "reports", "booking_requests", "resources"]) as Array<keyof typeof config.features>) assert.equal(config.features[capability], true);
    const owner = navigationForIndustry(config, "owner");
    for (const key of (industry === "hospitality" ? ["dashboard", "rooms", "customers", "staff", "inventory", "payments", "reports", "branches", "settings"] : ["dashboard", "appointments", "bookings", "customers", "services", "staff", "inventory", "payments", "reports", "resources", "branches", "settings"])) assert.ok(owner.some(item => item.key === key), `${industry} lacks ${key}`);
    assert.equal(owner.find(row => row.key === "payments")?.href, "/dashboard/payments");
    assert.ok(navigationForIndustry(config, "cashier").some(row => row.key === "payments"));
    assert.equal(navigationForIndustry(config, "viewer").some(row => row.key === "payments"), false);
    assert.equal(navigationForIndustry(config, "technician").some(row => row.key === "reports"), false);
    assert.ok(navigationForIndustry(config, "viewer").some(row => row.key === "reports"));
  });
}
test("financial totals read beyond API row limits and reject incomplete reads", async () => {
  const rows = Array.from({length: 2051}, (_, id) => ({id}));
  assert.equal((await readAllFinancialRows((from,to) => Promise.resolve({data:rows.slice(from,to+1),error:null}))).length,2051);
  await assert.rejects(readAllFinancialRows((from,to) => Promise.resolve(from ? {data:null,error:{message:"database unavailable"}} : {data:rows.slice(from,to+1),error:null})), /Unable to load payment records/);
});
test("payment summary uses branch calendar dates and excludes reversed transactions", () => {
  const payment = (id:string, amount:number, paid_at:string, status="paid", method="cash"):LedgerPayment => ({id,amount_centavos:amount,paid_at,status,method,invoice_id:null,appointment_id:"visit",reference:null});
  const records=[payment("1",1000,"2026-01-02T15:59:00Z"),payment("2",2000,"2026-01-02T16:00:00Z"),payment("3",500,"2026-01-02T16:01:00Z","reversed"),payment("4",700,"2026-01-02T17:00:00Z","paid","card")];
  const documents:PaymentDocument[]=[{id:"visit",kind:"appointment",label:"Appointment",customer:"Test",date:null,total:5000,balance:2300}];
  const summary=summarizePayments(records,documents,"Asia/Manila",new Date("2026-01-02T18:00:00Z"));
  assert.deepEqual(summary,{collected:2700,count:2,outstanding:2300,byMethod:[["cash",2000],["card",700]]});
  assert.equal(summarizePayments([],[],"UTC").outstanding,0);
});
test("Pet workspace reads shared financial records without the unavailable Pet RPC", () => {
  for(const path of ["app/dashboard/pet-care/page.tsx","app/dashboard/pet-care/payments/page.tsx","components/payment-workspace.tsx"]) assert.doesNotMatch(readFileSync(path,"utf8"),/pet_care_financial_summary/);
});
test("report CSV treats formulas as text",()=>{
  for(const value of ["=SUM(A1)","+1", "@command", " -1"]) assert.ok(csvCell(value).startsWith("'"));
  assert.equal(csvCell(-100),"-100");
});
