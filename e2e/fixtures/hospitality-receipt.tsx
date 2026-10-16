import { createRoot } from "react-dom/client";
import { CheckInReceipt } from "@/components/hospitality/check-in-receipt";
createRoot(document.getElementById("root")!).render(<CheckInReceipt stayId="test" organization="Example Apartelle" branch="Main branch" guest="Walk-in guest" room="Room 101" checkIn="Oct 16, 2026, 2:00 PM" periodEnd="Oct 17, 2026, 2:00 AM" number="REC-0001" cashier="Cashier" amounts={{ payment:80000,deposit:20000,total:100000,tendered:120000,change:20000,method:"cash",currency:"PHP",label:"12 hours",durationMinutes:720 }}/ >);
