import { ListTabs } from "@/components/list-tabs";

export function RoomsTabs({ value }: { value: "all" | "history" }) {
  return <ListTabs id="hospitality-rooms-tabs"
    baseHref="/dashboard/hospitality/rooms" parameter="tab" query={{}} value={value}
    options={[{ value: "all", label: "Rooms" }, { value: "history", label: "Stay history" }]}/>;
}
