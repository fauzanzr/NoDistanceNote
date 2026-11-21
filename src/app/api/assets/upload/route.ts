import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { store } from "@/lib/storage";

export const dynamic = "force-dynamic";
const EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp",
};

export async function POST(req: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !EXT[file.type]) {
    return NextResponse.json({ error: "Only PNG, JPG, GIF or WebP images are allowed" }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Max 8 MB" }, { status: 413 });
  const rand = Math.random().toString(36).slice(2, 7);
  const name = `img-${Math.floor(Date.now() / 1000)}-${rand}.${EXT[file.type]}`;
  const fileId = await store.uploadAsset(name, file.type, Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ fileId, url: `/api/assets/${fileId}` });
}
