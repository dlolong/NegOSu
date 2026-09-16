import { productBrand, verticalBrands } from "@/modules/platform/brand";

export const industryKeys = ["automotive", "salon", "pet_care", "hospitality", "field_service"] as const;
export type IndustryKey = (typeof industryKeys)[number];

export const industryFeatureKeys = [
  "pets",
  "vehicles",
  "appointments",
  "job_orders",
  "inventory",
  "payments",
  "reports",
  "commissions",
  "reservations",
  "queue",
  "maintenance",
  "booking_requests",
  "resources",
] as const;
export type IndustryFeatureKey = (typeof industryFeatureKeys)[number];

export type IndustryConfig = {
  key: IndustryKey;
  productName: string;
  terminology: {
    customer: string;
    staff: string;
    booking: string;
    location: string;
    service: string;
    resource: string;
    product: string;
  };
  features: Readonly<Record<IndustryFeatureKey, boolean>>;
};

export const karkrAutomotiveConfig: IndustryConfig = {
  key: "automotive",
  productName: verticalBrands.automotive.displayName,
  terminology: {
    customer: "Customer",
    staff: "Staff",
    booking: "Appointment",
    location: "Branch",
    service: "Service",
    resource: "Service bay",
    product: "Product",
  },
  features: {
    pets: false,
    vehicles: true,
    appointments: true,
    job_orders: true,
    inventory: true,
    payments: true,
    reports: true,
    commissions: false,
    reservations: false,
    queue: true,
    maintenance: true,
    booking_requests: true,
    resources: true,
  },
};

export const salonConfig: IndustryConfig = {
  key: "salon",
  productName: verticalBrands.salon.displayName,
  terminology: {
    customer: "Client",
    staff: "Staff",
    booking: "Appointment",
    location: "Branch",
    service: "Treatment",
    resource: "Station",
    product: "Product",
  },
  features: {
    pets: false,
    vehicles: false,
    appointments: true,
    job_orders: false,
    inventory: true,
    payments: true,
    reports: true,
    commissions: false,
    reservations: false,
    queue: false,
    maintenance: false,
    booking_requests: true,
    resources: true,
  },
};

export const petCareConfig: IndustryConfig = {
  key: "pet_care", productName: "NegOSu Pet Care",
  terminology: { customer: "Pet Owner", staff: "Staff", booking: "Grooming appointment", location: "Branch", service: "Service", resource: "Grooming resource", product: "Product" },
  features: { pets: true, vehicles: false, appointments: true, job_orders: false, inventory: true, payments: true, reports: true, commissions: false, reservations: false, queue: false, maintenance: false, booking_requests: true, resources: true },
};

const disabledIndustryConfig = (key: "hospitality" | "field_service"): IndustryConfig => ({
  ...salonConfig,
  key,
  productName: productBrand.name,
  features: Object.fromEntries(industryFeatureKeys.map((feature) => [feature, false])) as Record<IndustryFeatureKey, boolean>,
});

export const hospitalityConfig: IndustryConfig = {
  ...disabledIndustryConfig("hospitality"),
  productName: "NegOSu Apartelle & Inn",
  terminology: { customer: "Guest", staff: "Staff", booking: "Stay", location: "Branch", service: "Charge", resource: "Room", product: "Product" },
  features: { ...disabledIndustryConfig("hospitality").features, inventory: true, payments: true, reports: true },
};

const industryConfigs: Record<IndustryKey, IndustryConfig> = {
  automotive: karkrAutomotiveConfig,
  salon: salonConfig,
  pet_care: petCareConfig,
  hospitality: hospitalityConfig,
  field_service: disabledIndustryConfig("field_service"),
};

export function resolveIndustryConfig(key: string | null | undefined): IndustryConfig {
  const config = industryConfigs[key as IndustryKey];
  if (!config) throw new Error("Unsupported organization industry.");
  return config;
}

export function industrySupportsFeature(config: IndustryConfig, feature: IndustryFeatureKey) {
  return config.features[feature];
}
