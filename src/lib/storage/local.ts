import fs from "node:fs/promises";
import path from "node:path";
import type { Store } from "./types";

// Mode pengembangan lokal: meniru struktur Drive (notes/, assets/) di folder .data
const ROOT = path.join(process.cwd(), ".data");
const NOTES = path.join(ROOT, "notes");
const ASSETS = path.join(ROOT, "assets");
const TRASH = path.join(ROOT, "trash");
const FILES = path.join(ROOT, "files");
const META = path.join(ROOT, "files-meta.json");
async function readMeta(): Promise<Record<string, { device: string; os: string }>> {
  try { return JSON.parse(await fs.readFile(META, "utf8")); } catch { return {}; }
}
const safe = (id: string) => {
  if (!/^[\w.\-]+$/.test(id) || id.includes("..")) throw new Error("Invalid id");
  return id;
};
const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
};
async function init() {
  await Promise.all([NOTES, ASSETS, TRASH, FILES].map((d) => fs.mkdir(d, { recursive: true })));
}

export const localStore: Store = {
  async listNotes() {
    await init();
    const names = (await fs.readdir(NOTES)).filter((n) => n.endsWith(".md"));
    return Promise.all(
      names.map(async (name) => ({ id: name, name, content: await fs.readFile(path.join(NOTES, name), "utf8") }))
    );
  },
  async getNote(id) {
    await init();
    try {
      return { id, name: id, content: await fs.readFile(path.join(NOTES, safe(id)), "utf8") };
    } catch { return null; }
  },
  async createNote(name, content) {
    await init();
    let n = name, i = 1;
    while (await fs.stat(path.join(NOTES, n)).then(() => true, () => false)) n = name.replace(/\.md$/, `-${++i}.md`);
    await fs.writeFile(path.join(NOTES, n), content);
    return n;
  },
  async updateNote(id, content, name) {
    await init();
    await fs.writeFile(path.join(NOTES, safe(id)), content);
    // Nama file lokal dipertahankan agar id stabil.
    void name;
  },
  async trashNote(id) {
    await init();
    await fs.rename(path.join(NOTES, safe(id)), path.join(TRASH, `${Date.now()}-${safe(id)}`));
  },
  async uploadAsset(name, _mime, data) {
    await init();
    await fs.writeFile(path.join(ASSETS, safe(name)), data);
    return name;
  },
  async getAsset(id) {
    await init();
    try {
      const data = await fs.readFile(path.join(ASSETS, safe(id)));
      return { data, mime: MIME[id.split(".").pop() ?? ""] ?? "application/octet-stream" };
    } catch { return null; }
  },
  async listFiles() {
    await init();
    const meta = await readMeta();
    const names = await fs.readdir(FILES);
    return Promise.all(
      names.map(async (n) => {
        const st = await fs.stat(path.join(FILES, n));
        return {
          id: n,
          name: n.replace(/^\d+-[a-z0-9]{5}-/, ""),
          size: st.size,
          mime: "",
          createdAt: st.birthtime.toISOString(),
          device: meta[n]?.device,
          os: meta[n]?.os,
        };
      })
    );
  },
  async storageInfo() {
    return { mode: "local" as const, account: "Local storage (development mode)", path: ".data/files" };
  },
  async uploadFile(name, _mime, data, m) {
    await init();
    const clean = name.replace(/[^\w.\-]+/g, "_").slice(-120) || "file";
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7).padEnd(5, "0")}-${clean}`;
    await fs.writeFile(path.join(FILES, id), data);
    if (m) {
      const all = await readMeta();
      all[id] = m;
      await fs.writeFile(META, JSON.stringify(all));
    }
    return id;
  },
  async appendFileChunk(uploadId, name, chunk, offset, totalSize, m) {
    await init();
    const safeUid = uploadId.replace(/[^\w\-]+/g, "").slice(0, 40) || "upload";
    const clean = name.replace(/[^\w.\-]+/g, "_").slice(-120) || "file";
    const tmpPath = path.join(TRASH, `.part-${safeUid}-${clean}`);
    if (offset === 0) {
      await fs.writeFile(tmpPath, chunk);
    } else {
      await fs.appendFile(tmpPath, chunk);
    }
    if (offset + chunk.length >= totalSize) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7).padEnd(5, "0")}-${clean}`;
      await fs.rename(tmpPath, path.join(FILES, id));
      if (m) {
        const all = await readMeta();
        all[id] = m;
        await fs.writeFile(META, JSON.stringify(all));
      }
      return { done: true, id };
    }
    return { done: false };
  },
  async getFile(id) {
    await init();
    try {
      const data = await fs.readFile(path.join(FILES, safe(id)));
      return { data, name: id.replace(/^\d+-[a-z0-9]{5}-/, ""), mime: "application/octet-stream" };
    } catch { return null; }
  },
  async deleteFile(id) {
    await init();
    await fs.rename(path.join(FILES, safe(id)), path.join(TRASH, `${Date.now()}-${safe(id)}`));
  },
  async renameFile(id, name) {
    await init();
    const prefix = id.match(/^\d+-[a-z0-9]{5}-/)?.[0] ?? `${Date.now()}-00000-`;
    const clean = name.replace(/[^\w.\-]+/g, "_").slice(-120) || "file";
    const newId = prefix + clean;
    if (newId !== id) {
      await fs.rename(path.join(FILES, safe(id)), path.join(FILES, safe(newId)));
      const all = await readMeta();
      if (all[id]) {
        all[newId] = all[id];
        delete all[id];
        await fs.writeFile(META, JSON.stringify(all));
      }
    }
    return { id: newId, name: clean };
  },
  async readOtk() {
    await init();
    try { return JSON.parse(await fs.readFile(path.join(ROOT, "otk.json"), "utf8")); } catch { return {}; }
  },
  async writeOtk(data) {
    await init();
    await fs.writeFile(path.join(ROOT, "otk.json"), JSON.stringify(data));
  },
};
