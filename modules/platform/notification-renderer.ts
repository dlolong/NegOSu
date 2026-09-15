import { renderPetCareNotification } from "@/modules/pet-care/notifications/templates";
import type{NotificationTemplateRenderer}from"@/lib/notifications/outbox";
import{renderAutomotiveNotification}from"@/modules/automotive/notifications/automotive-notification.templates";
import{renderSalonAppointmentReminder}from"@/modules/salon/notifications/appointment-reminder.templates";
export function renderPlatformNotification(appUrl:string):NotificationTemplateRenderer{const automotive=renderAutomotiveNotification(appUrl),salon=renderSalonAppointmentReminder(appUrl),petCare=renderPetCareNotification(appUrl);return input=>input.templateKey.startsWith("pet-care-")?petCare(input):input.templateKey.startsWith("salon-")?salon(input):automotive(input);}
