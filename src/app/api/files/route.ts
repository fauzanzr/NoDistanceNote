import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { store } from "@/lib/storage";
import { detectDevice } from "@/lib/files";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  const list = await store.listFiles();
  list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received" }, { status: 400 });
  const name = file.name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").slice(0, 200) || "file";
  const dev = detectDevice(req.headers.get("user-agent") ?? "");
  const id = await store.uploadFile(name, file.type, Buffer.from(await file.arrayBuffer()), dev);
  return NextResponse.json({
    id, name, size: file.size, mime: file.type, createdAt: new Date().toISOString(),
    device: dev.device, os: dev.os,
  });
}

/**
 * Chunked upload endpoint untuk mode server/lokal agar file > 1 GB dapat diunggah per-chunk
 * tanpa membebani memori Node.js / batas FormData.
 */
export async function PUT(req: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;
  const uploadId = req.headers.get("x-upload-id") ?? "";
  const rawName = decodeURIComponent(req.headers.get("x-file-name") ?? "");
  const mime = req.headers.get("x-file-mime") || "application/octet-stream";
  const offset = Number(req.headers.get("x-chunk-offset") ?? "0");
  const totalSize = Number(req.headers.get("x-file-size") ?? "0");
  if (!uploadId || !rawName || !Number.isFinite(offset) || !Number.isFinite(totalSize)) {
    return NextResponse.json({ error: "Invalid chunk metadata" }, { status: 400 });
  }
  const name = rawName.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").slice(0, 200) || "file";
  const dev = detectDevice(req.headers.get("user-agent") ?? "");
  const chunk = Buffer.from(await req.arrayBuffer());

  if (store.appendFileChunk) {
    const res = await store.appendFileChunk(uploadId, name, chunk, offset, totalSize, dev);
    if (!res.done) return NextResponse.json({ partial: true }, { status: 202 });
    return NextResponse.json({
      id: res.id, name, size: totalSize, mime, createdAt: new Date().toISOString(),
      device: dev.device, os: dev.os,
    });
  }

  // Fallback apabila store tidak mendukung appendFileChunk
  const id = await store.uploadFile(name, mime, chunk, dev);
  return NextResponse.json({
    id, name, size: totalSize, mime, createdAt: new Date().toISOString(),
    device: dev.device, os: dev.os,
  });
}
