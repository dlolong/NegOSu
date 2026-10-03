import { Badge } from "@/components/ui/badge";
export function RoomStatus({ status }: { status: string }) {
  const label = status === "vacant" ? "Available" : status === "occupied" ? "Occupied" : status === "cleaning" ? "Cleaning" : "Inactive";
  return <Badge variant={status === "vacant" ? "success" : status === "occupied" ? "info" : status === "cleaning" ? "warning" : "neutral"}>{label}</Badge>;
}
