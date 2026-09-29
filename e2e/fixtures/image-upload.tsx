import { createRoot } from "react-dom/client";
import { ImageUploadField } from "@/components/image-upload-field";
createRoot(document.getElementById("root")!).render(<form><ImageUploadField id="test-photo" name="photo" label="Business photo"/><button type="submit">Save</button></form>);
