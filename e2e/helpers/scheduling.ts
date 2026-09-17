import { createClient } from "@supabase/supabase-js";
import { expect } from "@playwright/test";
import { qaPersonaCredentials, type QaPersonaKind } from "./auth";

/** Choose a real open branch day instead of assuming a future date is a working day. */
export async function qaAppointmentStart(kind:QaPersonaKind,daysAhead=21) {
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  const auth=await db.auth.signInWithPassword(qaPersonaCredentials(kind));expect(auth.error).toBeNull();
  try {
    const membership=await db.from("organization_memberships").select("organization_id").eq("user_id",auth.data.user!.id).single();expect(membership.error).toBeNull();
    const branch=await db.from("branches").select("opening_hours").eq("organization_id",membership.data!.organization_id).eq("is_primary",true).single();expect(branch.error).toBeNull();
    const hours=branch.data!.opening_hours as Record<string,{open?:string;close?:string;closed?:boolean}>;
    const weekdays=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
    for(let offset=daysAhead;offset<daysAhead+14;offset++) {
      const day=new Date();day.setUTCDate(day.getUTCDate()+offset);
      const window=hours[weekdays[day.getUTCDay()]];
      if(window&&!window.closed&&window.open&&window.close&&window.close>window.open) return `${day.toISOString().slice(0,10)}T${window.open}`;
    }
    throw new Error("QA branch has no open day in the next two-week fixture window.");
  } finally {await db.auth.signOut({scope:"local"});}
}
