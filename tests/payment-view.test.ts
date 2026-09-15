import assert from "node:assert/strict";
import test from "node:test";
import { paymentView, paymentViewHref } from "../modules/core/payments/payment-view";
import { summarizePayments, type LedgerPayment, type PaymentDocument } from "../modules/core/payments/payment-workspace";

const documents: PaymentDocument[] = [
  {id:"visit",kind:"appointment",label:"Appointment",customer:"Maria Santos",date:"2026-09-15T08:00:00Z",total:20000,balance:5000},
  {id:"invoice",kind:"invoice",label:"INV-102",customer:"Juan Cruz",date:"2026-09-14T08:00:00Z",total:10000,balance:10000},
  {id:"settled",kind:"appointment",label:"Appointment",customer:"Ana Reyes",date:null,total:10000,balance:0},
];
const payments: LedgerPayment[] = [
  {id:"paid",appointment_id:"visit",invoice_id:null,amount_centavos:15000,method:"bank_transfer",status:"paid",reference:"Transfer 001",paid_at:"2026-09-15T08:00:00Z"},
  {id:"pending",appointment_id:null,invoice_id:"invoice",amount_centavos:10000,method:"gcash",status:"pending",reference:null,paid_at:null},
];

test("payment views default to balances, preserve old page links and tolerate repeated query parameters", () => {
  assert.equal(paymentView(payments,documents,{}).tab,"outstanding");
  assert.equal(paymentView(payments,documents,{page:"2"}).tab,"history");
  assert.equal(paymentView(payments,documents,{outstandingPage:"2"}).tab,"outstanding");
  assert.equal(paymentView(payments,documents,{tab:"invalid",page:"2"}).tab,"outstanding");
  const repeated=paymentView(payments,documents,{tab:["history","outstanding"],q:[" Maria ","Juan"],page:["1","3"]});
  assert.equal(repeated.tab,"history");assert.equal(repeated.search,"Maria");assert.equal(repeated.count,1);
});
test("outstanding searches customers and documents, excludes settled records and orders oldest first", () => {
  assert.deepEqual(paymentView(payments,documents,{}).outstanding.map(row=>row.id),["invoice","visit"]);
  assert.equal(paymentView(payments,documents,{q:"mArIa"}).outstanding[0].id,"visit");
  assert.equal(paymentView(payments,documents,{q:"INV-102"}).outstanding[0].id,"invoice");
  assert.equal(paymentView(payments,documents,{q:"Ana"}).count,0);
});
test("history searches customer, document, reference, readable method and status", () => {
  for(const q of ["MARIA","transfer 001","bank transfer","paid"]){
    assert.deepEqual(paymentView(payments,documents,{tab:"history",q}).history.map(row=>row.id),["paid"]);
  }
  for(const q of ["Juan","INV-102","GCash","pending"]){
    assert.deepEqual(paymentView(payments,documents,{tab:"history",q}).history.map(row=>row.id),["pending"]);
  }
});
test("filtering leaves financial totals and source records intact", () => {
  const original=JSON.stringify({payments,documents});
  const before=summarizePayments(payments,documents,"UTC",new Date("2026-09-15T09:00:00Z"));
  const view=paymentView(payments,documents,{q:"Juan"});
  assert.equal(view.count,1);assert.equal(view.outstandingCount,2);assert.equal(view.historyCount,2);
  assert.deepEqual(summarizePayments(payments,documents,"UTC",new Date("2026-09-15T09:00:00Z")),before);
  assert.equal(JSON.stringify({payments,documents}),original);
});
test("pagination has 25 stable records per page and clamps invalid or out-of-range pages", () => {
  const rows=Array.from({length:52},(_,i)=>({...payments[0],id:String(i).padStart(3,"0")})).reverse();
  const first=paymentView(rows,documents,{tab:"history"});
  const second=paymentView(rows,documents,{tab:"history",page:"2"});
  assert.equal(first.history.length,25);assert.equal(first.history[0].id,"000");
  assert.equal(second.history.length,25);assert.equal(second.history[0].id,"025");
  assert.equal(second.pages,3);assert.equal(second.offset,25);
  assert.equal(paymentView(rows,documents,{tab:"history",page:"999"}).history.length,2);
  for(const page of ["invalid","0","-2"]){assert.equal(paymentView(rows,documents,{tab:"history",page}).page,1);}
  const noResults=paymentView(rows,documents,{tab:"history",q:"missing",page:"999"});
  assert.equal(noResults.page,1);assert.equal(noResults.pages,1);assert.equal(noResults.count,0);
});
test("links preserve filters, reset page on tab changes and encode search safely", () => {
  assert.equal(paymentViewHref("/dashboard/payments","outstanding"),"/dashboard/payments?tab=outstanding");
  const url=new URL(paymentViewHref("/dashboard/pet-care/payments","history","A & B + test",3),"http://local.test");
  assert.equal(url.searchParams.get("q"),"A & B + test");assert.equal(url.searchParams.get("page"),"3");
  assert.equal(new URL(paymentViewHref("/dashboard/payments","outstanding","A & B + test"),url).searchParams.has("page"),false);
  assert.equal(paymentView([],[],{q:"x".repeat(200)}).search.length,120);
});
