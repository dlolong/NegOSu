const tones = {
 rose: "border-pink-200 bg-pink-50 text-pink-800",
 green: "border-emerald-200 bg-emerald-50 text-emerald-800",
 blue: "border-blue-200 bg-blue-50 text-blue-800",
 purple: "border-violet-200 bg-violet-50 text-violet-800",
 amber: "border-amber-200 bg-amber-50 text-amber-900",
 red: "border-red-200 bg-red-50 text-red-800",
 gray: "border-slate-200 bg-slate-100 text-slate-700",
 cyan: "border-cyan-200 bg-cyan-50 text-cyan-800",
 orange: "border-orange-200 bg-orange-50 text-orange-900",
} as const;
const groups: Record<keyof typeof tones, string[]> = {
 rose: ["no_show"],
 green: ["active","completed","paid","approved","available","published","public","delivered","sent","resolved","fulfilled","ready","accepted","consumed","fully_reserved","in_stock","ready_for_release"],
 blue: ["confirmed","scheduled","booked","reserved","posted","assigned"],
 purple: ["in_progress","in_service","serving","occupied","processing","quality_check","partially_reserved","partially_paid","partial","converted_to_job"],
 amber: ["pending","waiting","unpaid","requested","needs_reply","awaiting_payment","awaiting_approval","low","low_stock","shortage","awaiting_parts","awaiting_customer","pending_confirmation"],
 red: ["cancelled","canceled","failed","rejected","declined","overdue","out_of_stock","void","voided","out"],
 gray: ["inactive","archived","draft","closed","private","disabled","unavailable"],
 cyan: ["checked_in","returned","refunded","checked_out","called","open"],
 orange: ["queued","cleaning","maintenance","on_hold","blocked","expired","partially_refunded"],
};
export function statusColor(value: string): string | undefined {
 const key = value.trim().toLowerCase().replace(/[ -]+/g,"_");
 const tone = (Object.keys(groups) as Array<keyof typeof tones>).find(t => groups[t].includes(key));
 return tone ? tones[tone] : undefined;
}
