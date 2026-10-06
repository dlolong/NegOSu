import { z } from "zod";

export const inquirySchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(120),
  email: z.email().max(254).transform(value => value.toLowerCase()),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(5000),
  website: z.string().max(0).default(""),
});
export type InquiryState = { error?: string; success?: boolean };
