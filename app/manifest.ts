import type { MetadataRoute } from "next";
import { productBrand } from "@/modules/platform/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: productBrand.name,
    short_name: productBrand.shortName,
    description: productBrand.description,
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/images/NegOSu_logo_512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/images/NegOSu_logo_1024x1024.png", sizes: "1024x1024", type: "image/png", purpose: "any" },
    ],
  };
}
