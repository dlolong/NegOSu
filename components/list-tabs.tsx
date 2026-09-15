import { Tabs } from "@/components/ui/tabs";
import { listHref } from "@/lib/list-navigation";

export function ListTabs({ id, baseHref, query, parameter = "status", value, options }: {
  id: string; baseHref: string; query: Record<string,string|undefined>; parameter?: string; value: string;
  options: {value:string;label:string;count?:number}[];
}) {
  const selected = Array.isArray(value) ? String(value[0]??"") : value;
  const views = options.some(option=>option.value===selected) ? options : [...options,{value:selected,label:selected.replaceAll("_"," ")}];
  return <Tabs id={id} className="mt-5" ariaLabel="List views" items={views.map(option => ({
    id:`${id}-${option.value || "all"}`,label:option.label,count:option.count,active:option.value===selected,
    href:listHref(baseHref,query,{[parameter]:option.value,page:undefined}),
  }))}/>;
}
