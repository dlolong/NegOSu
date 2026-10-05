import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { appointmentBackLink } from "@/modules/core/crm/client-reminders";
export function AppointmentBackButton({ from, pet = false }: { from?: string; pet?: boolean }) {
  const back = appointmentBackLink(from, pet);
  return <Button asChild variant="ghost"><Link id="appointment-back-button" href={back.href}><ArrowLeft aria-hidden="true" size={16}/>{back.label}</Link></Button>;
}
