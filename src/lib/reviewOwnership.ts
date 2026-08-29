import { createHmac } from "node:crypto";

export function reviewOwnerKey(email: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set");
  }

  return createHmac("sha256", secret).update(email.trim().toLowerCase()).digest("hex");
}
