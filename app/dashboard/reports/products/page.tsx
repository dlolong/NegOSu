import { PageTitle } from "@/components/page-title";
import Link from "next/link";
import {notFound} from "next/navigation";
import {getDashboardContext} from "@/lib/auth/context";
import {createClient} from "@/lib/supabase/server";
import {formatMoney} from "@/lib/operations";
import {checkoutRoles} from "@/modules/core/checkout/contracts";
import {RecordTable} from "@/components/record-table";
import {reportActionError} from "@/lib/errors/action-error";
import {loadProductReport,productReportPage,type ProductReport} from "@/modules/core/checkout/product-report";
export default async function Page({searchParams}:{searchParams:Promise<{page?:string}>}){
 const [{activeMembership:m},q,db]=await Promise.all([getDashboardContext(),searchParams,createClient()]);if(!checkoutRoles.includes(m.role))notFound();
 const page=productReportPage(q.page);let report:ProductReport|null=null;
 try { report=await loadProductReport(db,m.branchId,page); }
 catch(error) { reportActionError("reports.products",error,"Unable to load product sales."); }
 return <main id="product-sales-report" className="mx-auto min-w-0 max-w-6xl"><PageTitle back={<Link className="inline-flex min-h-11 items-center underline" href="/dashboard/reports">Back to reports</Link>} className="text-2xl">Product sales & handover</PageTitle><p className="mt-2 text-sm">{m.branchName} · All time. Posted product bills only; voided bills are excluded from sales. Promo inclusions have no additional revenue. Physical returns and refunds remain separate.</p>{!report?<div id="product-sales-load-error" role="alert" className="mt-4"><p>Unable to load product sales. Please try again. If this continues, contact your business administrator.</p><Link id="product-sales-retry" className="mt-2 inline-flex min-h-11 items-center underline" href={`/dashboard/reports/products?page=${page}`}>Try again</Link></div>:<><dl className="my-4 grid gap-3 sm:grid-cols-3">{[["Product sales",report.sales],["Collected on product bills",report.paid],["Product bill balance",report.balance]].map(([label,value])=><div key={label} className="rounded-xl border border-admin-border bg-white p-4"><dt className="text-sm">{label}</dt><dd className="mt-2 text-xl">{formatMoney(Number(value),m.currency)}</dd></div>)}</dl><RecordTable searchable id="product-sales-table" caption="Products sold and fulfilled" columns={[{key:"name",label:"Product"},{key:"sold",label:"Sold",secondary:true},{key:"included",label:"Included",secondary:true},{key:"handed",label:"Handed over",secondary:true},{key:"returned",label:"Returned",secondary:true},{key:"amount",label:"Sales",align:"right"}]} rows={report.rows.map((r,index)=>({id:`product-sales-${r.inventory_item_id}-${index}`,cells:{name:<>{r.name}<small className="block">{r.unit}</small></>,sold:r.sold,included:r.included,handed:r.handed_over,returned:r.returned,amount:formatMoney(r.sales,m.currency)},mobile:<p>Sold {r.sold} · Included {r.included} · Handed over {r.handed_over} · Returned {r.returned}</p>}))} empty="No product sales yet."/><nav className="mt-4 flex justify-between" aria-label="Product sales pages">{page>1?<Link className="p-3 underline" href={`?page=${page-1}`}>Previous</Link>:<span/>}{report.rows.length===50?<Link className="p-3 underline" href={`?page=${page+1}`}>Next</Link>:null}</nav></>}</main>;
}
