export type NoteMeta = {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  pinned: boolean;
  encrypted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Note = NoteMeta & { body: string };

/** Note dengan id = ID file Drive (dipakai di API [id]); metaId = id di frontmatter. */
const q = (s: string) => JSON.stringify(s);

export function parseNote(fileId: string, text: string): Note {
  const now = new Date().toISOString();
  const meta: Record<string, string | boolean> = {};
  let body = text;
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (m) {
    body = text.slice(m[0].length);
    for (const line of m[1].split(/\r?\n/)) {
      const i = line.indexOf(":");
      if (i < 0) continue;
      const k = line.slice(0, i).trim();
      let v = line.slice(i + 1).trim();
      if (v === "true" || v === "false") meta[k] = v === "true";
      else {
        try { v = v.startsWith('"') ? JSON.parse(v) : v; } catch { /* keep raw */ }
        meta[k] = v;
      }
    }
  }
  return {
    id: fileId,
    title: String(meta.title ?? "Untitled"),
    subtitle: String(meta.subtitle ?? ""),
    color: String(meta.color ?? ""),
    pinned: meta.pinned === true,
    encrypted: meta.encrypted === true,
    createdAt: String(meta.createdAt ?? now),
    updatedAt: String(meta.updatedAt ?? meta.createdAt ?? now),
    body,
  };
}

export function serializeNote(n: Note, frontId: string): string {
  return [
    "---",
    `id: ${q(frontId)}`,
    `title: ${q(n.title)}`,
    `subtitle: ${q(n.subtitle)}`,
    `color: ${q(n.color)}`,
    `pinned: ${n.pinned}`,
    `encrypted: ${n.encrypted}`,
    `createdAt: ${q(n.createdAt)}`,
    `updatedAt: ${q(n.updatedAt)}`,
    "---",
    n.body,
  ].join("\n");
}

export function fileNameFor(title: string, date = new Date()): string {
  const d = date.toISOString().slice(0, 10).replace(/-/g, "");
  const slug =
    title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) ||
    "untitled";
  return `${d}-${slug}.md`;
}
