import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { imageFileType, imageUploadAllowed, MAX_IMAGE_BYTES } from "@/modules/platform/image-upload";

const reply = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET() {
  const { activeMembership: member } = await getDashboardContext();
  if (!["owner", "manager"].includes(member.role)) return reply({ error: "Settings access required." }, 403);
  const db = await createClient();
  const { data, error } = await db.rpc("get_org_entitlements", { p_organization_id: member.organizationId });
  if (error || !data) return reply({ error: "Upload availability could not be checked." }, 503);
  return reply({ allowed: imageUploadAllowed(data), owner: member.role === "owner" });
}

export async function POST(request: Request) {
  // Session-cookie writes require a same-origin browser request.
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Invalid upload origin." }, 403);
  const { activeMembership: member } = await getDashboardContext();
  if (!["owner", "manager"].includes(member.role)) return reply({ error: "Settings access required." }, 403);
  const db = await createClient();
  const { data: ent, error: entError } = await db.rpc("get_org_entitlements", { p_organization_id: member.organizationId });
  if (entError || !ent) return reply({ error: "Upload availability could not be checked." }, 503);
  if (!imageUploadAllowed(ent)) return reply({ error: "Upgrade your plan to upload images.", upgrade: true }, 403);
  // Bound streamed bodies too; Content-Length alone is not trustworthy.
  const reader = request.body?.getReader();
  if (!reader) return reply({ error: "Choose an image." }, 400);
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_IMAGE_BYTES + 16384) { await reader.cancel(); return reply({ error: "Choose an image up to 2 MB." }, 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let form: FormData;
  try { form = await new Response(bytes, { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData(); }
  catch { return reply({ error: "Invalid image upload." }, 400); }
  const file = form.get("image");
  if (!(file instanceof File) || !file.size || file.size > MAX_IMAGE_BYTES) return reply({ error: "Choose a JPG, PNG or WebP up to 2 MB." }, 400);
  const buffer = new Uint8Array(await file.arrayBuffer());
  const type = imageFileType(buffer);
  if (!type || type.mime !== file.type) return reply({ error: "Choose a valid JPG, PNG or WebP image." }, 400);
  const path = `${member.organizationId}/${crypto.randomUUID()}.${type.extension}`;
  const { error } = await db.storage.from("business-images").upload(path, buffer, { contentType: type.mime, upsert: false, cacheControl: "31536000" });
  if (error) return reply({ error: "Upload failed. Your plan may have expired or its image storage may be full. Check Billing & Plan or try again." }, 400);
  return reply({ url: db.storage.from("business-images").getPublicUrl(path).data.publicUrl });
}
