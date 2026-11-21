import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { store } from "@/lib/storage";
import { attachment, previewType } from "@/lib/files";

export const dynamic = "force-dynamic";
type Ctx = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Ctx) {
  const denied = await requireAuth();
  if (denied) return denied;

  // Inisialisasi sesi Direct Download (agar browser bisa mengunduh langsung dari Google Drive + menampilkan progress & Mbps)
  if (req.nextUrl.searchParams.get("session") === "1") {
    if (store.getDownloadSession) {
      const sess = await store.getDownloadSession(params.id).catch(() => null);
      if (!sess) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(sess);
    }
    const f = await store.getFile(params.id).catch(() => null);
    if (!f) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      mode: "server",
      url: `/api/files/${encodeURIComponent(params.id)}`,
      name: f.name,
      size: f.data.length,
      mime: f.mime,
    });
  }

  // Untuk unduhan biasa (non-inline), gunakan stream bila tersedia agar file > 1 GB tidak memenuhi RAM Node.js
  if (req.nextUrl.searchParams.get("inline") !== "1" && store.getFileStream) {
    const sf = await store.getFileStream(params.id).catch(() => null);
    if (!sf) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return new NextResponse(sf.stream, {
      headers: {
        "Content-Type": sf.mime || "application/octet-stream",
        "Content-Length": String(sf.size),
        "Content-Disposition": attachment(sf.name),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const f = await store.getFile(params.id).catch(() => null);
  if (!f) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Pratinjau inline (gambar/video) dengan dukungan Range agar video bisa di-seek.
  if (req.nextUrl.searchParams.get("inline") === "1") {
    const pv = previewType(f.name);
    if (!pv) return NextResponse.json({ error: "Preview not supported" }, { status: 415 });
    const total = f.data.length;
    const base = {
      "Content-Type": pv.mime,
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
    };
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
    if (m && (m[1] || m[2])) {
      let start = m[1] ? parseInt(m[1], 10) : total - parseInt(m[2], 10);
      let end = m[1] && m[2] ? parseInt(m[2], 10) : total - 1;
      start = Math.max(0, start);
      end = Math.min(total - 1, end);
      if (start > end) return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
      return new NextResponse(new Uint8Array(f.data.subarray(start, end + 1)), {
        status: 206,
        headers: { ...base, "Content-Range": `bytes ${start}-${end}/${total}`, "Content-Length": String(end - start + 1) },
      });
    }
    return new NextResponse(new Uint8Array(f.data), { headers: { ...base, "Content-Length": String(total) } });
  }

  return new NextResponse(new Uint8Array(f.data), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(f.data.length),
      "Content-Disposition": attachment(f.name),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const denied = await requireAuth();
  if (denied) return denied;
  const b = (await req.json().catch(() => ({}))) as { name?: string };
  const name = (b.name ?? "").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").trim().slice(0, 200);
  if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
  try {
    return NextResponse.json(await store.renameFile(params.id, name));
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const denied = await requireAuth();
  if (denied) return denied;
  try {
    await store.deleteFile(params.id); // dipindah ke Trash
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
