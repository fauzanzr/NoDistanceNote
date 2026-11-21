import { NextRequest, NextResponse } from "next/server";
import { zipSync } from "fflate";
import { requireAuth } from "@/lib/session";
import { store } from "@/lib/storage";
import { attachment } from "@/lib/files";

export const dynamic = "force-dynamic";
const MAX_TOTAL = 200 * 1024 * 1024;

// GET langsung (bukan fetch tersembunyi) => browser & IDM mendeteksi sebagai unduhan biasa.
export async function GET(req: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;
  const ids = (req.nextUrl.searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 100);
  if (!ids.length) return NextResponse.json({ error: "No files selected" }, { status: 400 });

  const found = (await Promise.all(ids.map((id) => store.getFile(id).catch(() => null)))).filter(
    (f): f is NonNullable<typeof f> => !!f
  );
  if (!found.length) return NextResponse.json({ error: "Files not found" }, { status: 404 });
  if (found.reduce((n, f) => n + f.data.length, 0) > MAX_TOTAL) {
    return NextResponse.json({ error: "Selection too large for one ZIP (max 200 MB)" }, { status: 413 });
  }

  const entries: Record<string, Uint8Array> = {};
  for (const f of found) {
    let name = f.name;
    for (let i = 2; entries[name]; i++) {
      const dot = f.name.lastIndexOf(".");
      name = dot > 0 ? `${f.name.slice(0, dot)} (${i})${f.name.slice(dot)}` : `${f.name} (${i})`;
    }
    entries[name] = new Uint8Array(f.data);
  }
  const zip = zipSync(entries, { level: 0 });
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const zipName = `NoDistanceNote-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.zip`;

  return new NextResponse(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(zip.length),
      "Content-Disposition": attachment(zipName),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
