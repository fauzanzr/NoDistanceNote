import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { store } from "@/lib/storage";
import { detectDevice } from "@/lib/files";

export const dynamic = "force-dynamic";
const MAX = 1024 * 1024 * 1024; // 1 GB

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
  if (file.size > MAX) return NextResponse.json({ error: "File is too large (max 1 GB)" }, { status: 413 });
  const name = file.name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").slice(0, 200) || "file";
  const dev = detectDevice(req.headers.get("user-agent") ?? "");
  const id = await store.uploadFile(name, file.type, Buffer.from(await file.arrayBuffer()), dev);
  return NextResponse.json({
    id, name, size: file.size, mime: file.type, createdAt: new Date().toISOString(),
    device: dev.device, os: dev.os,
  });
}
