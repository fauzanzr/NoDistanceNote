import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { store } from "@/lib/storage";
import { fileNameFor, parseNote, serializeNote } from "@/lib/notes";

export const dynamic = "force-dynamic";
type Ctx = { params: { id: string } };

export async function GET(_: NextRequest, { params }: Ctx) {
  const denied = await requireAuth();
  if (denied) return denied;
  const f = await store.getNote(params.id);
  if (!f) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(parseNote(params.id, f.content));
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const denied = await requireAuth();
  if (denied) return denied;
  const f = await store.getNote(params.id);
  if (!f) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const cur = parseNote(params.id, f.content);
  const frontId = f.content.match(/^id:\s*"?([^"\r\n]+)"?/m)?.[1] ?? `note_${Date.now()}`;
  const b = (await req.json().catch(() => ({}))) as Partial<{
    title: string; subtitle: string; color: string; content: string; pinned: boolean; encrypted: boolean;
  }>;
  const next = {
    ...cur,
    title: typeof b.title === "string" ? b.title.trim() || "Untitled" : cur.title,
    subtitle: typeof b.subtitle === "string" ? b.subtitle.slice(0, 200) : cur.subtitle,
    color: typeof b.color === "string" ? b.color : cur.color,
    body: typeof b.content === "string" ? b.content : cur.body,
    pinned: typeof b.pinned === "boolean" ? b.pinned : cur.pinned,
    encrypted: typeof b.encrypted === "boolean" ? b.encrypted : cur.encrypted,
    updatedAt: new Date().toISOString(),
  };
  const rename = next.title !== cur.title ? fileNameFor(next.title, new Date(cur.createdAt)) : undefined;
  await store.updateNote(params.id, serializeNote(next, frontId), rename);
  return NextResponse.json({ ...next, id: params.id });
}

export async function DELETE(_: NextRequest, { params }: Ctx) {
  const denied = await requireAuth();
  if (denied) return denied;
  try {
    await store.trashNote(params.id); // dipindah ke Trash, bukan hapus permanen
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
