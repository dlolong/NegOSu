/** Additive access matrix for an explicitly selected disposable local database. */
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { assertQaFixtureUser, assertQaSeedSafety, parseQaSeedMode, formatQaSeedOperatorError } from "./qa-seed-safety";

const mode = parseQaSeedMode(process.argv.slice(2));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
assertQaSeedSafety({ mode, supabaseUrl:url, approvedTargetUrl:process.env.QA_SEED_APPROVED_TARGET_URL, nodeEnv:process.env.NODE_ENV, vercelEnv:process.env.VERCEL_ENV, qaSeedTarget:process.env.QA_SEED_TARGET, allowRemoteDevelopment:undefined, confirmation:undefined });
if (!url || !["localhost","127.0.0.1","[::1]"].includes(new URL(url).hostname)) throw new Error("Access fixtures require a disposable local target.");
const password = process.env.QA_OWNER_PASSWORD;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!password || !key || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Protected local QA configuration is required.");
const admin = createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const id = (name:string) => {
  const hex=createHash("sha256").update(`negosu-access-qa:${name}`).digest("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-8${hex.slice(17,20)}-${hex.slice(20,32)}`;
};
async function must<T extends {data:unknown;error:unknown}>(query:PromiseLike<T>):Promise<T["data"]> {const result=await query;if(result.error)throw result.error;return result.data;}
async function fixtureUser(name:string) {
  const email=`qa.access.${name}@negosu.local.test`, marker=`access-${name}`;
  let existing;
  for(let page=1;;page++) {
    const result=await must(admin.auth.admin.listUsers({page,perPage:1000}));
    existing=result.users.find(user=>user.email===email);
    if(existing||result.users.length<1000)break;
  }
  if(existing){assertQaFixtureUser(existing,marker);return existing;}
  const created=await must(admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{negosu_qa_fixture:marker},user_metadata:{full_name:`QA Access ${name}`}}));
  if(!created.user)throw new Error("Synthetic user creation failed.");
  return created.user;
}
async function membership(org:string,user:string,role:"owner"|"manager"|"technician") {
  const row=await must(admin.from("organization_memberships").upsert({organization_id:org,user_id:user,role,is_active:true},{onConflict:"organization_id,user_id"}).select("id").single());
  if(!row)throw new Error("Fixture membership not returned.");
  return row;
}
async function main() {
  const slugs=["negosu-automotive-qa","negosu-salon-qa","negosu-pet-qa-1","qa-apartelle-inn"];
  const organizations=await must(admin.from("organizations").select("id,slug,industry,business_type,branches(id,is_primary)").in("slug",slugs));
  if(!organizations||organizations.length!==4)throw new Error("Seed all four primary vertical fixtures first.");
  if(mode==="dry-run"){console.log("Access fixture preflight: four primary businesses found; no writes performed.");return;}
  const multi=await fixtureUser("multi"),unassigned=await fixtureUser("unassigned");
  for(const org of organizations) {
    const branch=org.branches.find(row=>row.is_primary)?.id;
    if(!branch)throw new Error("Primary QA branch missing.");
    const manager=await fixtureUser(`${org.industry}.manager`),staff=await fixtureUser(`${org.industry}.staff`),other=await fixtureUser(`${org.industry}.other`);
    const managerMembership=await membership(org.id,manager.id,"manager");
    const staffMembership=await membership(org.id,staff.id,"technician");
    await membership(org.id,multi.id,"owner");
    await must(admin.from("membership_branch_assignments").upsert({membership_id:managerMembership.id,organization_id:org.id,branch_id:branch}));
    await must(admin.from("branches").upsert({id:id(`${org.id}-annex`),organization_id:org.id,name:"Access QA Annex",is_active:true,is_primary:false,timezone:"Asia/Manila"}));
    const linked=await must(admin.from("organization_staff_profiles").select("id").eq("organization_id",org.id).eq("membership_id",staffMembership.id).maybeSingle());
    await must(admin.from("organization_staff_profiles").upsert({id:linked?.id??id(`${org.id}-login`),organization_id:org.id,membership_id:staffMembership.id,full_name:"QA Staff with login",job_function:"Operations",email:staff.email,is_active:true}));
    for(const contact of ["email","mobile","both","neither"]) {
      await must(admin.from("organization_staff_profiles").upsert({id:id(`${org.id}-${contact}`),organization_id:org.id,membership_id:null,full_name:`QA Staff ${contact} contact`,job_function:"Operations",email:["email","both"].includes(contact)?`qa.${contact}@example.test`:null,mobile:["mobile","both"].includes(contact)?"+639170000000":null,is_active:true}));
    }
    const otherSlug=`negosu-access-${org.industry.replaceAll("_","-")}-other`;
    const otherOrganization=await must(admin.from("organizations").select("id,created_by,industry").eq("slug",otherSlug).maybeSingle());
    if(otherOrganization&&(otherOrganization.created_by!==other.id||otherOrganization.industry!==org.industry))throw new Error("Secondary fixture organization ownership conflict.");
    const actor=createClient(url!,key!,{auth:{persistSession:false,autoRefreshToken:false}});
    await must(actor.auth.signInWithPassword({email:other.email!,password:password!}));
    const otherOrgId=otherOrganization?.id ?? await must(actor.rpc("create_first_organization",{p_name:`QA Isolation ${org.industry}`,p_industry:org.industry,p_business_type:org.business_type,p_slug_base:otherSlug}));
    const otherBranches=await must(admin.from("branches").select("id").eq("organization_id",otherOrgId).limit(1));
    if(!otherBranches?.length) await must(actor.rpc("create_initial_branch",{p_organization_id:otherOrgId,p_name:"Isolation QA Branch",p_address_line:"Local synthetic fixture",p_city:"Test city",p_province:"Test province"}));
    await must(admin.from("customers").upsert({id:id(`${org.id}-foreign-customer`),organization_id:otherOrgId,full_name:`QA isolated ${org.industry} customer`,email:null,phone:null}));
    await actor.auth.signOut({scope:"local"});
    console.log(`[qa-access] ${org.industry}: manager, login Staff, four independent contact profiles, secondary tenant, multi-organization access ready.`);
  }
  const memberships=await must(admin.from("organization_memberships").select("id").eq("user_id",unassigned.id));
  if(memberships?.length)throw new Error("Unassigned fixture unexpectedly has membership; no memberships were removed.");
  console.log("Access matrix fixtures ready. Existing passwords were not changed; providers were not invoked.");
}
main().catch(error=>{console.error("Access fixture setup failed:",formatQaSeedOperatorError(error));process.exitCode=1;});
