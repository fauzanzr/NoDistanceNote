import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE = "ndn_session";
const key = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET belum diset");
  return new TextEncoder().encode(s);
};

/** Session cookie tanpa Max-Age => hangus saat browser ditutup. */
export async function createSession() {
  const token = await new SignJWT({ sub: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(key());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
}

export function clearSession() {
  cookies().set(COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
}

export async function isAuthed() {
  const t = cookies().get(COOKIE)?.value;
  if (!t) return false;
  try {
    await jwtVerify(t, key());
    return true;
  } catch {
    return false;
  }
}

export async function requireAuth(): Promise<NextResponse | null> {
  return (await isAuthed()) ? null : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
