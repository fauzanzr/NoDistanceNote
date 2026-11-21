import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { store } from "@/lib/storage";
import { detectDevice } from "@/lib/files";

export const dynamic = "force-dynamic";
const MAX = 1024 * 1024 * 1024; // 1 GB

/**
 * Inisialisasi Direct Resumable Upload ke Google Drive.
 * Server hanya membuat session URL (beberapa byte), lalu browser mengunggah file langsung ke Google Drive
 * sehingga bebas dari batas 4,5 MB Vercel Serverless Function.
 */
export async function POST(req: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;
  const b = (await req.json().catch(() => ({}))) as { name?: string; mime?: string; size?: number };
  const rawName = String(b.name ?? "").trim();
  if (!rawName) return NextResponse.json({ error: "File name is required" }, { status: 400 });
  const size = Number(b.size ?? 0);
  if (size > MAX) return NextResponse.json({ error: "File is too large (max 1 GB)" }, { status: 413 });
  const name = rawName.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").slice(0, 200) || "file";
  const mime = String(b.mime || "application/octet-stream");
  const dev = detectDevice(req.headers.get("user-agent") ?? "");

  if (!store.createUploadSession) {
    return NextResponse.json({ mode: "server", name, device: dev.device, os: dev.os });
  }
  const origin = req.headers.get("origin") ?? req.nextUrl.origin;
  const uploadUrl = await store.createUploadSession(name, mime, size, origin, dev);
  if (!uploadUrl) {
    return NextResponse.json({ mode: "server", name, device: dev.device, os: dev.os });
  }
  return NextResponse.json({ mode: "direct", uploadUrl, name, mime, size, device: dev.device, os: dev.os });
}
