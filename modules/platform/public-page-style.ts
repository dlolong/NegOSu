import { z } from "zod";

export const publicPageStyleIds = ["standard", "elegant", "precision", "retreat", "friendly"] as const;
export type PublicPageStyleId = (typeof publicPageStyleIds)[number];
export const publicHeroPositions = ["center", "left", "right"] as const;
export type PublicHero = { headline?: string | null; eyebrow?: string | null; description?: string | null; position?: string | null };

const standard = { id: "standard", name: "Standard", description: "Your familiar public page layout." } as const;
const industryStyles = {
  salon: { id: "elegant", name: "Elegant", description: "Graceful serif headings and a full-width photographic introduction." },
  automotive: { id: "precision", name: "Precision", description: "Bold headings, structured sections and a strong workshop introduction." },
  hospitality: { id: "retreat", name: "Retreat", description: "An immersive property photograph and spacious, welcoming details." },
  pet_care: { id: "friendly", name: "Friendly", description: "Soft shapes, rounded headings and a cheerful introduction." },
} as const;

export function publicPageStylesForIndustry(industry: string) {
  const style = Object.hasOwn(industryStyles, industry) ? industryStyles[industry as keyof typeof industryStyles] : undefined;
  return style ? [standard, style] : [standard];
}
export function isPublicPageStyleForIndustry(value: unknown, industry: string): value is PublicPageStyleId {
  return publicPageStylesForIndustry(industry).some(style => style.id === value);
}
export function resolvePublicPageStyle(value: unknown, industry: string): PublicPageStyleId {
  return isPublicPageStyleForIndustry(value, industry) ? value : "standard";
}
export function resolvePublicHeroPosition(value: unknown): (typeof publicHeroPositions)[number] {
  return publicHeroPositions.includes(value as (typeof publicHeroPositions)[number]) ? value as (typeof publicHeroPositions)[number] : "center";
}
export const publicPageAppearanceSchema = z.object({
  pageStyle: z.enum(publicPageStyleIds),
  headline: z.string().trim().max(120, "Keep the headline to 120 characters."),
  eyebrow: z.string().trim().max(60, "Keep the introductory label to 60 characters."),
  description: z.string().trim().max(300, "Keep the hero description to 300 characters."),
  position: z.enum(publicHeroPositions),
});

export function publicPageStyleContent(industry: string) {
  switch (industry) {
    case "salon": return { eyebrow: "Care for you", headline: "Make time for yourself.", description: "Explore our treatments and plan your next visit.", action: "Book an appointment", closing: "Your next moment of care starts here." };
    case "automotive": return { eyebrow: "Your vehicle. Our care.", headline: "Keep your journey moving.", description: "Explore our services and request a time to bring your vehicle in.", action: "Book a service", closing: "Ready for your next service?" };
    case "hospitality": return { eyebrow: "Stay a little longer", headline: "A place to feel at home.", description: "Explore our property and contact us for room rates and availability.", action: "Contact for availability", closing: "Let’s plan your stay." };
    case "pet_care": return { eyebrow: "A little care. A happy pet.", headline: "Good care for your best friend.", description: "Explore our grooming services and plan your pet’s next visit.", action: "Book grooming", closing: "Ready for a fresh look and a happy tail?" };
    default: return { eyebrow: "Welcome", headline: "Plan your next visit.", description: "Explore what we offer and get in touch.", action: "Book an appointment", closing: "We look forward to welcoming you." };
  }
}
