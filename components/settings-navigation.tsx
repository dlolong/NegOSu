import { Tabs, type TabItem } from "@/components/ui/tabs";

export function SettingsNavigation({ industry }: { industry: string }) {
  const salon=industry==="salon";
  const prefix=salon?"salon-settings":"settings";
  const items:TabItem[]=[
    {id:`${prefix}-tab-profile`,label:"Profile & workspace",description:"Your details, logo and colors",href:"/dashboard/settings"},
    {id:`${prefix}-tab-branches`,label:"Branches",description:"Locations and contact details",href:"/dashboard/settings/branches"},
    {id:`${prefix}-tab-staff`,label:"Staff",description:"Team profiles and login access",href:"/dashboard/settings/staff"},
    {id:`${prefix}-tab-resources`,label:industry === "automotive" ? "Service bays" : "Resources",description:"Spaces and equipment",href:"/dashboard/settings/resources"},
    {id:`${prefix}-tab-public-page`,label:"Website & booking",description:"What your customers see",href:"/dashboard/settings/public-page"},
    {id:`${prefix}-tab-billing`,label:"Billing & plan",description:"Subscription and payments",href:"/dashboard/settings/billing"},
  ];
  return <Tabs id={salon?"salon-settings-navigation":"settings-sections-navigation"} variant="cards" ariaLabel="Settings sections" items={items.filter(item => industry !== "hospitality" || !["/dashboard/settings/resources", "/dashboard/settings/public-page"].includes(item.href))}/>;
}
