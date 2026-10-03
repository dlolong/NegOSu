import { ListTabs } from "@/components/list-tabs";
export function BookingTabs({ value }: { value: "rooms" | "history" }) {
  return <ListTabs id="hospitality-bookings-tabs" baseHref="/dashboard/hospitality/bookings" parameter="tab" query={{}} value={value} options={[{ value: "rooms", label: "Rooms & status" }, { value: "history", label: "Booking history" }]}/>;
}
