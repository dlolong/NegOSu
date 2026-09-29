import { createRoot } from "react-dom/client";
import { ServiceThumbnail } from "@/components/service-thumbnail";
import { ServiceThumbnailForm } from "@/components/service-thumbnail-form";
const id = "a1000000-0000-4000-8000-000000000001";
createRoot(document.getElementById("root")!).render(<>
  <ServiceThumbnailForm service={{ id, name: "Signature treatment", thumbnail_url: "https://photos.test/valid.png" }}/>
  <div className="grid gap-4 sm:grid-cols-3">
    <ServiceThumbnail id="public-valid-photo" url="https://photos.test/valid.png" name="Signature treatment"/>
    <ServiceThumbnail id="public-empty-photo" name="Consultation"/>
    <ServiceThumbnail id="public-broken-photo" url="https://photos.test/broken.png" name="Grooming"/>
  </div>
</>);
