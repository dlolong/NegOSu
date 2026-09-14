import { LoadingSkeleton } from "@/components/page-patterns";
export default function Loading() {
  return <div id="inventory-loading" className="mx-auto min-w-0 max-w-7xl" aria-busy="true">
    <LoadingSkeleton id="inventory-header-loading" lines={2}/>
    <div className="my-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{[1, 2, 3, 4].map(index => <LoadingSkeleton key={index} id={`inventory-metric-loading-${index}`} lines={2}/>)}</div>
    <LoadingSkeleton id="inventory-stock-loading" lines={8}/>
  </div>;
}
