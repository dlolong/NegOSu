import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertQaFixtureUser } from "./qa-seed-safety";

/** Invoked only by the existing guarded QA seed, with --pet-care on localhost. */
export async function seedPetCareFixtures(admin: SupabaseClient, url: string) {
  if (!["127.0.0.1", "localhost", "::1"].includes(new URL(url).hostname) || process.env.NODE_ENV === "production") throw new Error("Pet fixtures require local non-production Supabase.");
  const password = process.env.QA_OWNER_PASSWORD;
  const emails = [process.env.QA_PET_OWNER_EMAIL, process.env.QA_PET_OTHER_EMAIL];
  if (!password || emails.some(email => !email)) throw new Error("Set QA_OWNER_PASSWORD, QA_PET_OWNER_EMAIL, and QA_PET_OTHER_EMAIL in protected local test configuration.");
  const check = <T extends { data: unknown; error: unknown }>(result: T): T["data"] => { if (result.error) throw result.error; return result.data; };
  for (let tenant = 1; tenant <= 2; tenant++) {
    const id = (kind: number, item = 1) => `7e${tenant}${kind}0000-0000-4000-8000-${String(item).padStart(12,"0")}`;
    const org = id(2), branch = id(3), customer = id(4);
    const existing = check(await admin.from("organizations").select("industry").eq("id",org).maybeSingle());
    if (existing && existing.industry !== "pet_care") throw new Error("Pet fixture organization ID belongs to another industry.");
    check(await admin.from("organizations").upsert({id:org,name:tenant===1?"Milo Grooming QA":"Luna Grooming QA",slug:`negosu-pet-qa-${tenant}`,industry:"pet_care",business_type:"pet_grooming",public_page_enabled:true,status:"active",timezone:"Asia/Manila",currency:"PHP"}));
    check(await admin.from("branches").upsert({id:branch,organization_id:org,name:"Grooming QA Branch",accepts_public_bookings:true,is_primary:true,is_active:true,timezone:"Asia/Manila",opening_hours:Object.fromEntries(["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].map(day=>[day,{open:"08:00",close:"20:00"}]))}));
    // Same synthetic QA plan used by the existing Automotive/Salon fixture. No plan catalog changes.
    check(await admin.from("organization_subscriptions").upsert({organization_id:org,plan_id:"business",status:"active"},{onConflict:"organization_id"}));
    const email = emails[tenant-1]!;
    const users = check(await admin.auth.admin.listUsers({perPage:1000})).users;
    const existingUser = users.find(user=>user.email===email);
    const fixtureKey = `pet-care-owner-${tenant}`;
    if (existingUser) assertQaFixtureUser(existingUser, fixtureKey);
    const authUser = check(existingUser ? await admin.auth.admin.updateUserById(existingUser.id,{password,email_confirm:true}) : await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:`Pet Care QA ${tenant}`},app_metadata:{negosu_qa_fixture:fixtureKey}})).user;
    if (!authUser) throw new Error("Pet QA user could not be created.");
    check(await admin.from("organization_memberships").upsert({organization_id:org,user_id:authUser.id,role:"owner",is_active:true},{onConflict:"organization_id,user_id"}));
    check(await admin.from("customers").upsert({id:customer,organization_id:org,full_name:"Maria QA",email:null,phone:null,is_archived:false}));
    check(await admin.from("pet_profiles").upsert(["Milo","Luna"].map((name,index)=>({id:id(5,index+1),organization_id:org,customer_id:customer,name,species:index?"cat":"dog",breed:index?null:"Shih Tzu",is_active:true,handling_cautions:"Owner-reported QA note — keep internal."}))));
    check(await admin.from("organization_staff_profiles").upsert([
      {id:id(6,1),organization_id:org,full_name:"Ana QA",job_function:"Groomer",email:null,mobile:null},
      {id:id(6,2),organization_id:org,full_name:"Bo QA",job_function:"Groomer",email:"bo@example.test",mobile:null},
      {id:id(6,3),organization_id:org,full_name:"Cora QA",job_function:"Manager",email:"cora@example.test",mobile:"+639171234567"},
    ]));
    check(await admin.from("services").upsert(["Bath and brush","Full grooming","Nail trim"].map((name,index)=>({id:id(7,index+1),organization_id:org,name,is_public:true,is_active:true,duration_minutes:index===2?30:60,base_price_centavos:[50000,80000,20000][index]}))));
    check(await admin.from("scheduling_resources").upsert([1,2].map(index=>({id:id(8,index),organization_id:org,branch_id:branch,name:`Grooming Table ${index}`,resource_type:"station",capacity:1,is_active:true}))));
    const actor = createClient(url,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
    check(await actor.auth.signInWithPassword({email,password}));
    const appointments = check(await actor.from("appointments").select("id").eq("organization_id",org).limit(1));
    if (!appointments?.length) {
      for (let visit=0;visit<3;visit++) {
        const day = new Date(); day.setUTCDate(day.getUTCDate()+1+visit);
        day.setUTCHours(2,0,0,0);
        const appointment = check(await actor.rpc("save_pet_appointment",{p_pet_id:id(5,visit===1?2:1),p_appointment_id:null,p_branch_id:branch,p_service_ids:[id(7,1)],p_starts_at:day.toISOString(),p_staff_ids:[id(6,visit===1?2:1)],p_resource_ids:[id(8,visit===1?2:1)]}));
        for (const action of (visit===0?["confirm","arrive","start","finish","ready"]:visit===1?["confirm","arrive","start"]:["confirm"])) check(await actor.rpc("transition_pet_appointment",{p_appointment_id:appointment,p_action:action}));
        if (visit===0) check(await actor.rpc("record_appointment_payment",{p_appointment_id:appointment,p_amount_centavos:20000,p_method:"cash",p_idempotency_key:`pet-qa-${tenant}-partial`}));
      }
    }
    await actor.auth.signOut();
    console.log(`[qa-seed] Pet Care organization: negosu-pet-qa-${tenant}`);
  }
}
