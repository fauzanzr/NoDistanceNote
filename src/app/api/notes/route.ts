import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { store } from "@/lib/storage";
import { fileNameFor, parseNote, serializeNote } from "@/lib/notes";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;
  const files = await store.listNotes();
  return NextResponse.json(files.map((f) => parseNote(f.id, f.content)));
}

export async function POST(req: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;
  const b = (await req.json().catch(() => ({}))) as Partial<{ title: string; content: string }>;
  const now = new Date();
  const iso = now.toISOString();
  const note = {
    id: "",
    title: b.title?.trim() || "Untitled",
    subtitle: "",
    color: "",
    pinned: false,
    encrypted: false,
    createdAt: iso,
    updatedAt: iso,
    body: b.content ?? "",
  };
  const text = serializeNote(note, `note_${now.getTime()}`);
  const id = await store.createNote(fileNameFor(note.title, now), text);
  return NextResponse.json({ ...note, id });
}
