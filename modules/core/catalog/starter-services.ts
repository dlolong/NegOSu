/** Editable sample prices in PHP; these are setup values, not market quotations. */
export type StarterService = { name: string; category: string; durationMinutes: number; priceCentavos: number };
export const starterServices = {
  automotive: [
    { name: "Exterior car wash", category: "Wash and detailing", durationMinutes: 30, priceCentavos: 20000 },
    { name: "Interior vacuum", category: "Wash and detailing", durationMinutes: 30, priceCentavos: 15000 },
    { name: "Express detailing", category: "Wash and detailing", durationMinutes: 90, priceCentavos: 120000 },
    { name: "Exterior polishing", category: "Wash and detailing", durationMinutes: 120, priceCentavos: 180000 },
    { name: "Wax application", category: "Wash and detailing", durationMinutes: 60, priceCentavos: 60000 },
    { name: "Engine oil change labor", category: "Maintenance", durationMinutes: 60, priceCentavos: 50000 },
    { name: "Brake inspection", category: "Maintenance", durationMinutes: 45, priceCentavos: 35000 },
    { name: "Battery check", category: "Maintenance", durationMinutes: 20, priceCentavos: 15000 },
    { name: "Tire rotation", category: "Maintenance", durationMinutes: 45, priceCentavos: 40000 },
    { name: "Air-conditioning inspection", category: "Maintenance", durationMinutes: 45, priceCentavos: 50000 },
  ],
  salon: [
    { name: "Haircut and styling", category: "Hair care", durationMinutes: 45, priceCentavos: 35000 },
    { name: "Hair wash and blow-dry", category: "Hair care", durationMinutes: 45, priceCentavos: 30000 },
    { name: "Deep conditioning", category: "Hair care", durationMinutes: 60, priceCentavos: 60000 },
    { name: "Hair coloring", category: "Hair care", durationMinutes: 120, priceCentavos: 150000 },
    { name: "Basic facial", category: "Face and beauty", durationMinutes: 60, priceCentavos: 50000 },
    { name: "Hydrating facial", category: "Face and beauty", durationMinutes: 75, priceCentavos: 80000 },
    { name: "Eyebrow shaping", category: "Face and beauty", durationMinutes: 20, priceCentavos: 15000 },
    { name: "Classic manicure", category: "Nail care", durationMinutes: 30, priceCentavos: 20000 },
    { name: "Classic pedicure", category: "Nail care", durationMinutes: 45, priceCentavos: 25000 },
    { name: "Foot spa", category: "Nail care", durationMinutes: 60, priceCentavos: 40000 },
  ],
  pet_care: [
    { name: "Bath and brush", category: "Grooming", durationMinutes: 60, priceCentavos: 50000 },
    { name: "Full grooming", category: "Grooming", durationMinutes: 120, priceCentavos: 90000 },
    { name: "Nail trim", category: "Hygiene", durationMinutes: 20, priceCentavos: 15000 },
    { name: "Ear cleaning", category: "Hygiene", durationMinutes: 20, priceCentavos: 15000 },
    { name: "Paw trim", category: "Hygiene", durationMinutes: 30, priceCentavos: 20000 },
    { name: "Sanitary trim", category: "Hygiene", durationMinutes: 30, priceCentavos: 25000 },
    { name: "Deshedding session", category: "Coat care", durationMinutes: 60, priceCentavos: 60000 },
    { name: "Coat brushing", category: "Coat care", durationMinutes: 30, priceCentavos: 25000 },
    { name: "Puppy grooming introduction", category: "Grooming", durationMinutes: 45, priceCentavos: 40000 },
    { name: "Coat detangling", category: "Coat care", durationMinutes: 60, priceCentavos: 50000 },
  ],
} satisfies Record<string, StarterService[]>;
export type StarterIndustry = keyof typeof starterServices;
export function hasStarterCatalog(industry: string): industry is StarterIndustry { return Object.hasOwn(starterServices, industry); }
