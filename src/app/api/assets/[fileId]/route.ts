import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { store } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: { fileId: string } }) {
  const denied = await requireAuth();
  if (denied) return denied;
  const a = await store.getAsset(params.fileId).catch(() => null);
  if (!a) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(a.data), {
    headers: {
      "Content-Type": a.mime.startsWith("image/") ? a.mime : "application/octet-stream",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
