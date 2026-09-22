// Plan 04: "clientHash: sha256(ip + daily salt), first 12 chars." One-way,
// rotates daily (the date string doubles as the salt) so the same visitor's
// hash changes day to day — day-scoped correlation ("same client called
// twice today"), not permanent identification.
import { createHash } from "node:crypto";

export function clientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip");
}

export function clientHash(ip: string | null, now = new Date()): string | null {
  if (!ip) return null;
  const day = now.toISOString().slice(0, 10);
  const secret = process.env.MIRAGE_CLIENT_HASH_SECRET ?? "";
  return createHash("sha256").update(`${ip}:${day}:${secret}`).digest("hex").slice(0, 12);
}
