import crypto from "node:crypto";
import { authenticator } from "otplib";
import { store } from "./storage";

// ---- Rate limiting: maks 5 percobaan gagal per 2 menit per IP (in-memory, best-effort) ----
const WINDOW = 2 * 60_000;
const MAX_FAIL = 5;
const fails = new Map<string, number[]>();

export function rateLimited(ip: string) {
  const now = Date.now();
  const list = (fails.get(ip) ?? []).filter((t) => now - t < WINDOW);
  fails.set(ip, list);
  return list.length >= MAX_FAIL ? Math.ceil((WINDOW - (now - list[0])) / 1000) : 0;
}
export const recordFail = (ip: string) => fails.set(ip, [...(fails.get(ip) ?? []), Date.now()]);
export const clearFails = (ip: string) => fails.delete(ip);

// ---- TOTP ----
authenticator.options = { window: 1 };
export function verifyTotp(code: string) {
  const secret = process.env.TOTP_SECRET;
  if (!secret) return false;
  try { return authenticator.check(code, secret); } catch { return false; }
}

export function verifyPin(pin: string | undefined) {
  const master = process.env.MASTER_PIN;
  if (!master) return true;
  const a = crypto.createHash("sha256").update(pin ?? "").digest();
  const b = crypto.createHash("sha256").update(master).digest();
  return crypto.timingSafeEqual(a, b);
}

// ---- One-Time Key: 8 huruf, berlaku 3 menit, sekali pakai ----
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const OTK_TTL = 3 * 60_000;
const hash = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function createOtk() {
  let code = "";
  for (let i = 0; i < 8; i++) code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  const now = Date.now();
  const all = await store.readOtk();
  for (const k of Object.keys(all)) if (all[k] < now) delete all[k];
  all[hash(code)] = now + OTK_TTL;
  await store.writeOtk(all);
  return { code, expiresAt: now + OTK_TTL };
}

export async function consumeOtk(code: string) {
  const now = Date.now();
  const all = await store.readOtk();
  const h = hash(code.toUpperCase());
  const exp = all[h];
  for (const k of Object.keys(all)) if (all[k] < now) delete all[k];
  if (exp && exp > now) {
    delete all[h];
    await store.writeOtk(all);
    return true;
  }
  await store.writeOtk(all);
  return false;
}
