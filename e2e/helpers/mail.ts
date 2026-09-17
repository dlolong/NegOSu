import { expect, type Page } from "@playwright/test";

type Mail = {ID:string;To:Array<{Address:string}>};
/** Read only local captured mail for the exact synthetic recipient. Never log tokens. */
export async function confirmLocalSignup(page:Page,email:string) {
  const api=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  const app=new URL(process.env.E2E_BASE_URL!);
  const mailbox=new URL(process.env.E2E_MAILBOX_URL ?? `${api.protocol}//${api.hostname}:${Number(api.port)+3}`);
  for(const url of [api,app,mailbox]) if(!["localhost","127.0.0.1","[::1]"].includes(url.hostname))throw new Error("Captured mail requires local endpoints.");
  if(!email.endsWith("@negosu.local.test"))throw new Error("Only synthetic QA recipients may be read.");
  let found:Mail|undefined;
  await expect.poll(async()=>{
    const response=await fetch(new URL("/api/v1/messages?limit=1000",mailbox));
    if(!response.ok)throw new Error("Local mailbox unavailable.");
    const result=await response.json() as {messages:Mail[]};
    found=result.messages.find(message=>message.To.some(to=>to.Address===email));
    return Boolean(found);
  },{message:"Synthetic signup mail should arrive in local capture",timeout:15000}).toBe(true);
  const response=await fetch(new URL(`/api/v1/message/${encodeURIComponent(found!.ID)}`,mailbox));
  if(!response.ok)throw new Error("Captured signup mail could not be read.");
  const message=await response.json() as {HTML:string;Text:string};
  const links=[...`${message.HTML}\n${message.Text}`.matchAll(/https?:\/\/[^\s<>"']+/g)].map(match=>match[0].replaceAll("&amp;","&"));
  const verification=links.find(value=>{try {const url=new URL(value);return url.origin===api.origin&&url.pathname==="/auth/v1/verify"&&url.searchParams.get("type")==="signup";}catch{return false;}});
  if(!verification)throw new Error("No scoped local signup verification link found.");
  const redirect=new URL(verification).searchParams.get("redirect_to");
  if(!redirect||new URL(redirect).origin!==app.origin)throw new Error("Signup callback is outside the local application.");
  try {
    await page.goto(verification);
    await page.locator("#negosu-onboarding-business-form").waitFor({state:"visible"});
  } catch {
    await page.goto("/login");
    throw new Error("Local signup confirmation did not reach onboarding.");
  }
}
