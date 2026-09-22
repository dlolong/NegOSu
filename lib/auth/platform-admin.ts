import "server-only";
import { notFound } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/auth/context";
import { isPlatformAdmin } from "@/modules/platform/admin-access";

export async function requirePlatformAdmin() {
  const auth = await requireAuthenticatedUser("/admin");
  if (!isPlatformAdmin(auth.user.id, process.env.PLATFORM_ADMIN_USER_IDS)) notFound();
  return auth.user;
}
