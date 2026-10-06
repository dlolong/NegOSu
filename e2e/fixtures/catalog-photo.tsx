import { createRoot } from "react-dom/client";
import { CatalogPhotoField } from "@/components/catalog-photo-field";
import { CatalogPhotoEditor } from "@/components/catalog-photo-editor";
import { useState } from "react";
function Fixture() {
  const [saved, setSaved] = useState("");
  const [detail, setDetail] = useState("https://images.test/old.png");
  return <><form id="photo-parent" onSubmit={event => { event.preventDefault(); setSaved(String(new FormData(event.currentTarget).get("thumbnailUrl"))); }}>
    <CatalogPhotoField idPrefix="product-photo" initialUrl="https://images.test/old.png" name="Product" subject="product"/>
    <button id="parent-save" type="submit">Save product</button><output id="parent-result">{saved}</output>
  </form><CatalogPhotoEditor id="detail-photo" url={detail} name="Promo" subject="promo" saveLabel="Save photo" onSave={async url => { if (url.includes("reject")) return { error: "Photo changed. Refresh and try again." }; setDetail(url); }}/></>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
