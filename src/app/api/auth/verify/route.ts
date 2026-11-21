import { NextRequest, NextResponse } from "next/server";
import { clearFails, consumeOtk, rateLimited, recordFail, verifyPin, verifyTotp } from "@/lib/auth";
import { createSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const wait = rateLimited(ip);
  if (wait) {
    return NextResponse.json({ error: `Too many attempts. Try again in ${wait} second${wait === 1 ? "" : "s"}.` }, { status: 429 });
  }
  const { code = "", pin } = (await req.json().catch(() => ({}))) as { code?: string; pin?: string };
  const c = String(code).trim();

  let ok = false;
  if (/^\d{6}$/.test(c)) ok = verifyPin(pin) && verifyTotp(c);
  else if (/^[A-Za-z]{8}$/.test(c)) ok = await consumeOtk(c);

  if (!ok) {
    recordFail(ip);
    return NextResponse.json({ error: "Invalid key" }, { status: 401 });
  }
  clearFails(ip);
  await createSession();
  return NextResponse.json({ ok: true });
}
