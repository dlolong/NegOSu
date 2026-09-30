import { test } from "node:test";
import assert from "node:assert/strict";
import { eligibleAppointmentPromos, readAppointmentPromos, type AppointmentPromoChoice } from "../modules/core/commerce/appointment-promos";
const promo: AppointmentPromoChoice = { id:"10000000-0000-4000-8000-000000000001", name:"Cut and shampoo",description:"",serviceId:"10000000-0000-4000-8000-000000000002", branchId:"main",version:2,priceCentavos:120000,currency:"PHP",validFrom:"2026-10-01",validThrough:"2026-10-31" };
test("appointment promos match the selected branch and inclusive local booking dates",()=>{
 assert.deepEqual(eligibleAppointmentPromos([promo],"main","2026-10-01"),[promo]);
 assert.deepEqual(eligibleAppointmentPromos([promo],"main","2026-10-31"),[promo]);
 for(const date of ["2026-09-30","2026-11-01"])assert.deepEqual(eligibleAppointmentPromos([promo],"main",date),[]);
 assert.deepEqual(eligibleAppointmentPromos([promo],"other","2026-10-01"),[]);
 assert.deepEqual(eligibleAppointmentPromos([{...promo,validFrom:null,validThrough:null}],"main","2027-01-01").length,1);
});
test("promo submissions preserve version and reject malformed or repeated selections",()=>{
 const data=new FormData();assert.deepEqual(readAppointmentPromos(data),[]);
 data.set("promoSelections",JSON.stringify([{id:promo.id,version:2,priceCentavos:1}]));
 assert.deepEqual(readAppointmentPromos(data),[{id:promo.id,version:2}]);
 for(const input of ['null','invalid',JSON.stringify([{id:promo.id,version:0}]),JSON.stringify([{id:promo.id,version:2},{id:promo.id,version:2}])]){data.set("promoSelections",input);assert.throws(()=>readAppointmentPromos(data));}
});
