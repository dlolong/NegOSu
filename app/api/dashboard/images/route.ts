import { createHash } from "node:crypto";
import { z } from "zod";
import { getDashboardContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { imageFileType, imageUploadAccess, IMAGE_UPLOAD_UNAVAILABLE, MAX_IMAGE_BYTES } from "@/modules/platform/image-upload";

const reply = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET() {
  const { activeMembership: member, user } = await getDashboardContext();
  if (!["owner", "manager"].includes(member.role)) return reply({ error: "Settings access required." }, 403);
  const db = await createClient();
  const { data, error } = await db.rpc("get_org_entitlements", { p_organization_id: member.organizationId });
  if (error || !data) return reply({ error: "Upload availability could not be checked." }, 503);
  const access = imageUploadAccess(data);
  if (access === "unavailable") return reply({ error: IMAGE_UPLOAD_UNAVAILABLE }, 503);
  return reply({ allowed: access === "allowed", owner: member.role === "owner", organizationId: member.organizationId, actorId: user.id, cost: 0 });
}

export async function POST(request: Request) {
  // Session-cookie writes require a same-origin browser request.
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Invalid upload origin." }, 403);
  const { activeMembership: member } = await getDashboardContext();
  if (!["owner", "manager"].includes(member.role)) return reply({ error: "Settings access required." }, 403);
  const db = await createClient();
  const { data: ent, error: entError } = await db.rpc("get_org_entitlements", { p_organization_id: member.organizationId });
  if (entError || !ent) return reply({ error: "Upload availability could not be checked." }, 503);
  const access = imageUploadAccess(ent);
  if (access === "unavailable") return reply({ error: IMAGE_UPLOAD_UNAVAILABLE }, 503);
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
  const requestId = z.uuid().safeParse(form.get("requestId"));
  const maxCost = z.enum(["0", "1"]).safeParse(form.get("maxCost"));
  if (!requestId.success || !maxCost.success) return reply({ error: "Refresh the page and select the image again." }, 400);
  const args = { p_org: member.organizationId, p_request: requestId.data, p_hash: createHash("sha256").update(buffer).digest("hex"), p_extension: type.extension, p_max_cost: Number(maxCost.data) };
  const prepared = await db.rpc("prepare_credit_image", args);
  if (prepared.error || !prepared.data) return reply({ error: prepared.error?.code === "P0002" ? "Your plan access changed. Refresh to review your plan." : "Could not prepare the image. Retry the same file or check your access.", upgrade: false }, 400);
  if (prepared.data.code === "FEATURE_NOT_ENTITLED") return reply({error:"Your plan does not include image uploads.",upgrade:true,code:"FEATURE_NOT_ENTITLED"},403);
  const path = prepared.data.path as string;
  const success = async () => {
    return reply({ url: db.storage.from("business-images").getPublicUrl(path).data.publicUrl });
  };
  if (prepared.data.completed) return success();
  const { error } = await db.storage.from("business-images").upload(path, buffer, { contentType: type.mime, upsert: false, cacheControl: "31536000" });
  if (error) {
    // A competing retry may have committed this exact intent before this upload.
    const confirmed = await db.rpc("prepare_credit_image", args);
    if (!confirmed.error && confirmed.data?.completed) return success();
    return reply({ error: "Upload failed. Your plan may have expired or its image storage may be full. Check Billing & Plan or try again." }, 400);
  }
  return success();
}
