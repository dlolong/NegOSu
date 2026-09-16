import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import { petSchema, groomingActions, groomingStatus } from "../modules/pet-care/pets";
import { peakOccupancy } from "../modules/core/availability/availability.service";
import { renderPetCareNotification } from "../modules/pet-care/notifications/templates";
import { resolveIndustryConfig } from "../modules/platform/industry";
import { petCareBrand, supportedVerticalKeys } from "../modules/platform/brand";
import { isEnabledSignupIndustry } from "../modules/platform/product-entry";
const uuid = "7c400000-0000-4000-8000-000000000001";
test("Pet identity uses Core customer and does not require unknown information",()=>{
 const pet=petSchema.parse({id:null,customer_id:uuid,name:"Milo",species:"dog",size_category:null,is_active:true});
 assert.equal(pet.name,"Milo");assert.equal(pet.breed,null);assert.equal(pet.date_of_birth,null);
 assert.equal(petSchema.safeParse({...pet,customer_id:"invalid"}).success,false);
});
test("completion, ready, collection and payment are distinct",()=>{
 assert.deepEqual(groomingActions("completed","not_ready"),["ready"]);
 assert.deepEqual(groomingActions("completed","ready"),["collect"]);
 assert.deepEqual(groomingActions("completed","collected"),[]);
 assert.equal(groomingStatus("completed","not_ready"),"Grooming finished");
 assert.equal(groomingStatus("in_service","not_ready"),"Grooming in progress");
});
test("shared capacity measures peak occupancy across separate subintervals",()=>{
 const at=(h:number)=>`2026-10-01T${String(h).padStart(2,"0")}:00:00Z`;
 const items=[{startsAt:at(9),endsAt:at(10),quantity:1},{startsAt:at(10),endsAt:at(11),quantity:1}];
 assert.equal(peakOccupancy(items,new Date(at(9)),new Date(at(11))),1);
 assert.equal(peakOccupancy([...items,{startsAt:at(9),endsAt:at(11),quantity:1}],new Date(at(9)),new Date(at(11))),2);
});
test("Pet Care is available for public signup",()=>{
 assert.equal(resolveIndustryConfig("pet_care").productName,"NegOSu Pet Care");
 assert.equal(resolveIndustryConfig("pet_care").features.vehicles,false);
 assert.equal(isEnabledSignupIndustry("pet_care"),true);
});
test("Pet wording addresses owners and never includes handling notes",()=>{
 const render=renderPetCareNotification("https://example.test");
 const payload={businessName:"Test Grooming",branchName:"Main",ownerFirstName:"Maria",petName:"Milo",startsAt:"2026-10-01T10:00:00Z",timezone:"Asia/Manila",kind:"ready",services:["Bath and brush"],handling_cautions:"SECRET"};
 const result=render({templateKey:"pet-care-ready-email-v1",payload,deliverySecret:null});
 assert.match(result.body,/Hi Maria.*Milo is ready for pickup/);assert.doesNotMatch(result.body,/SECRET|delivered/);
 assert.throws(()=>render({templateKey:"pet-care-reminder-email-v1",payload:{...payload,kind:"reminder"},deliverySecret:null}));
});
test("Core and Pet runtime dependency directions stay one way",()=>{
 function files(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(item=>item.isDirectory()?files(`${dir}/${item.name}`):item.name.endsWith(".ts")?[`${dir}/${item.name}`]:[]);}
 for(const file of files("modules/core"))assert.doesNotMatch(readFileSync(file,"utf8"),/from\s*["']@\/modules\/(pet-care|salon|automotive)/);
 for(const file of files("modules/pet-care"))assert.doesNotMatch(readFileSync(file,"utf8"),/from\s*["']@\/modules\/(salon|automotive)/);
});

test("Pet Care marketing has a public landing page and standard signup",()=>{
 assert.equal(petCareBrand.path,"/pet-care");
 assert.equal(petCareBrand.displayName,"NegOSu Pet Care");
 assert.equal(petCareBrand.signupPath,"/signup?industry=pet_care");
 assert.deepEqual([...supportedVerticalKeys],["automotive","salon","pet_care","hospitality"]);
 assert.equal(isEnabledSignupIndustry("pet_care"),true);
});

test("Pet Care onboarding validates its business category and rejects cross-industry types", async()=>{
 const {signUpSchema,businessOnboardingSchema}=await import("../lib/auth/schemas");
 const {resolveBusinessIndustry}=await import("../modules/platform/product-entry");
 assert.equal(resolveBusinessIndustry("pet_grooming"),"pet_care");
 assert.equal(resolveBusinessIndustry("pet_spa"),"pet_care");
 const business={industry:"pet_care",businessType:"pet_grooming",businessName:"Milo Grooming",slug:"milo-grooming"};
 assert.equal(businessOnboardingSchema.safeParse(business).success,true);
 assert.equal(businessOnboardingSchema.safeParse({...business,businessType:"spa"}).success,false);
 assert.equal(signUpSchema.safeParse({industry:"pet_care",firstName:"Alex",lastName:"QA",email:"alex@example.test",password:"local-test-password",confirmPassword:"local-test-password"}).success,true);
});
test("Pet public intake requires a pet but discards vehicle input",async()=>{
 const {publicBookingSchemaForIndustry}=await import("../lib/public-booking");
 const input={slug:"milo",branchId:uuid,serviceIds:[uuid],preferredAt:"2026-10-02T02:00:00Z",customerName:"Alex QA",phone:"09171234567",email:"",customerNote:"",website:"",petName:"Milo",species:"dog",breed:"",vehicleMake:"Injected"};
 const schema=publicBookingSchemaForIndustry("pet_care");
 assert.equal(schema.safeParse(input).success,true);
 assert.equal(schema.safeParse({...input,petName:""}).success,false);
 assert.equal(schema.safeParse({...input,species:"invalid"}).success,false);
 assert.equal(schema.safeParse({...input,serviceIds:[uuid,uuid]}).success,false);
 assert.equal(schema.parse(input).vehicleMake,"");
});
test("Grooming notes bound content, IDs, and calendar dates",async()=>{
 const {groomingNoteSchema}=await import("../modules/pet-care/pets");
 const note={id:uuid,appointmentId:uuid,note:"  Coat brushed  ",nextVisitOn:""};
 assert.equal(groomingNoteSchema.parse(note).note,"Coat brushed");
 assert.equal(groomingNoteSchema.parse(note).nextVisitOn,null);
 assert.equal(groomingNoteSchema.safeParse({...note,note:" ".repeat(4)}).success,false);
 assert.equal(groomingNoteSchema.safeParse({...note,note:"x".repeat(3001)}).success,false);
 assert.equal(groomingNoteSchema.safeParse({...note,nextVisitOn:"2026-02-30"}).success,false);
});
test("Pet signup never falls back to creating an Automotive organization",async()=>{
 const {createFirstOrganizationWithCompatibility}=await import("../lib/auth/organization-onboarding");
 let count=0;
 const result=await createFirstOrganizationWithCompatibility(async()=>{count++;return {data:null,error:{code:"PGRST202"}};},{industry:"pet_care",businessName:"Milo Grooming",businessType:"pet_grooming",slug:"milo-grooming"});
 assert.equal(count,1);assert.equal(result.errorCode,"ONBOARDING_SCHEMA_OUTDATED");
});
