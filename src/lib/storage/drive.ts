import { google, drive_v3 } from "googleapis";
import { Readable } from "node:stream";
import type { Store } from "./types";

const FOLDER = "application/vnd.google-apps.folder";
let drive: drive_v3.Drive | null = null;
let oauth: InstanceType<typeof google.auth.OAuth2> | null = null;
let infoCache: { mode: "drive"; account: string; path: string } | null = null;
let ids: { notes: string; assets: string; files: string } | null = null;

function authClient() {
  if (!oauth) {
    oauth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    oauth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  }
  return oauth;
}

function client() {
  if (!drive) {
    drive = google.drive({ version: "v3", auth: authClient() });
  }
  return drive;
}

async function ensureFolder(name: string, parent: string) {
  const d = client();
  const r = await d.files.list({
    q: `'${parent}' in parents and name='${name}' and mimeType='${FOLDER}' and trashed=false`,
    fields: "files(id)",
  });
  if (r.data.files?.[0]?.id) return r.data.files[0].id;
  const c = await d.files.create({
    requestBody: { name, mimeType: FOLDER, parents: [parent] },
    fields: "id",
  });
  return c.data.id!;
}

async function folders() {
  if (!ids) {
    const root = process.env.DRIVE_ROOT_FOLDER_ID!;
    const [notes, assets, files] = await Promise.all([
      ensureFolder("notes", root), ensureFolder("assets", root), ensureFolder("files", root),
    ]);
    ids = { notes, assets, files };
  }
  return ids;
}

async function inFolder(fileId: string, folderId: string) {
  try {
    const r = await client().files.get({ fileId, fields: "parents,trashed,mimeType" });
    return !r.data.trashed && !!r.data.parents?.includes(folderId) ? r.data : null;
  } catch { return null; }
}

async function text(fileId: string) {
  const r = await client().files.get({ fileId, alt: "media" }, { responseType: "text" });
  return typeof r.data === "string" ? r.data : String(r.data);
}

export const driveStore: Store = {
  async listNotes() {
    const { notes } = await folders();
    const files: { id: string; name: string }[] = [];
    let pageToken: string | undefined;
    do {
      const r = await client().files.list({
        q: `'${notes}' in parents and trashed=false and name contains '.md'`,
        fields: "nextPageToken, files(id,name)",
        pageSize: 200,
        pageToken,
      });
      for (const f of r.data.files ?? []) if (f.id && f.name) files.push({ id: f.id, name: f.name });
      pageToken = r.data.nextPageToken ?? undefined;
    } while (pageToken);
    const out = [];
    for (let i = 0; i < files.length; i += 10) {
      out.push(...(await Promise.all(files.slice(i, i + 10).map(async (f) => ({ ...f, content: await text(f.id) })))));
    }
    return out;
  },
  async getNote(id) {
    const { notes } = await folders();
    const meta = await inFolder(id, notes);
    if (!meta) return null;
    return { id, name: "", content: await text(id) };
  },
  async createNote(name, content) {
    const { notes } = await folders();
    const r = await client().files.create({
      requestBody: { name, parents: [notes], mimeType: "text/markdown" },
      media: { mimeType: "text/markdown", body: Readable.from([content]) },
      fields: "id",
    });
    return r.data.id!;
  },
  async updateNote(id, content, name) {
    const { notes } = await folders();
    if (!(await inFolder(id, notes))) throw new Error("Not found");
    await client().files.update({
      fileId: id,
      requestBody: name ? { name } : {},
      media: { mimeType: "text/markdown", body: Readable.from([content]) },
    });
  },
  async trashNote(id) {
    const { notes } = await folders();
    if (!(await inFolder(id, notes))) throw new Error("Not found");
    await client().files.update({ fileId: id, requestBody: { trashed: true } });
  },
  async uploadAsset(name, mime, data) {
    const { assets } = await folders();
    const r = await client().files.create({
      requestBody: { name, parents: [assets], mimeType: mime },
      media: { mimeType: mime, body: Readable.from(data) },
      fields: "id",
    });
    return r.data.id!;
  },
  async getAsset(id) {
    const { assets } = await folders();
    const meta = await inFolder(id, assets);
    if (!meta) return null;
    const r = await client().files.get({ fileId: id, alt: "media" }, { responseType: "arraybuffer" });
    return { data: Buffer.from(r.data as ArrayBuffer), mime: meta.mimeType ?? "application/octet-stream" };
  },
  async listFiles() {
    const { files } = await folders();
    const out: { id: string; name: string; size: number; mime: string; createdAt: string; device?: string; os?: string }[] = [];
    let pageToken: string | undefined;
    do {
      const r = await client().files.list({
        q: `'${files}' in parents and trashed=false`,
        fields: "nextPageToken, files(id,name,size,mimeType,createdTime,appProperties)",
        pageSize: 200,
        pageToken,
      });
      for (const f of r.data.files ?? []) {
        if (f.id && f.name) {
          out.push({
            id: f.id, name: f.name, size: Number(f.size ?? 0),
            mime: f.mimeType ?? "", createdAt: f.createdTime ?? new Date().toISOString(),
            device: f.appProperties?.device, os: f.appProperties?.os,
          });
        }
      }
      pageToken = r.data.nextPageToken ?? undefined;
    } while (pageToken);
    return out;
  },
  async uploadFile(name, mime, data, meta) {
    const { files } = await folders();
    const r = await client().files.create({
      requestBody: { name, parents: [files], appProperties: meta ? { device: meta.device, os: meta.os } : undefined },
      media: { mimeType: mime || "application/octet-stream", body: Readable.from(data) },
      fields: "id",
    });
    return r.data.id!;
  },
  async createUploadSession(name, mime, size, origin, meta) {
    const { files } = await folders();
    const { token } = await authClient().getAccessToken();
    if (!token) throw new Error("Failed to get Google Drive access token");
    const contentType = mime || "application/octet-stream";
    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,mimeType,createdTime,appProperties",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": contentType,
          ...(size > 0 ? { "X-Upload-Content-Length": String(size) } : {}),
          ...(origin ? { Origin: origin } : {}),
        },
        body: JSON.stringify({
          name,
          parents: [files],
          mimeType: contentType,
          appProperties: meta ? { device: meta.device, os: meta.os } : undefined,
        }),
      }
    );
    if (!res.ok) throw new Error(`Drive upload session failed (${res.status})`);
    return res.headers.get("location");
  },
  async storageInfo() {
    if (infoCache) return infoCache;
    let account = "Google Drive";
    let root = "NoDistanceNote";
    try {
      const a = await client().about.get({ fields: "user(emailAddress,displayName)" });
      const u = a.data.user;
      if (u?.emailAddress) account = u.displayName ? `${u.displayName} (${u.emailAddress})` : u.emailAddress;
    } catch { /* keep default */ }
    try {
      const f = await client().files.get({ fileId: process.env.DRIVE_ROOT_FOLDER_ID!, fields: "name" });
      if (f.data.name) root = f.data.name;
    } catch { /* keep default */ }
    infoCache = { mode: "drive" as const, account, path: `My Drive / ${root} / files` };
    return infoCache;
  },
  async getDownloadSession(id) {
    const { files } = await folders();
    try {
      const m = await client().files.get({
        fileId: id,
        fields: "name,size,mimeType,parents,trashed",
      });
      if (m.data.trashed || !m.data.parents?.includes(files)) return null;
      const { token } = await authClient().getAccessToken();
      if (!token) return null;
      return {
        mode: "direct" as const,
        url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`,
        token,
        name: m.data.name ?? "file",
        size: Number(m.data.size ?? 0),
        mime: m.data.mimeType ?? "application/octet-stream",
      };
    } catch {
      return null;
    }
  },
  async getFile(id) {
    const { files } = await folders();
    try {
      const m = await client().files.get({ fileId: id, fields: "name,mimeType,parents,trashed" });
      if (m.data.trashed || !m.data.parents?.includes(files)) return null;
      const r = await client().files.get({ fileId: id, alt: "media" }, { responseType: "arraybuffer" });
      return { data: Buffer.from(r.data as ArrayBuffer), name: m.data.name ?? "file", mime: m.data.mimeType ?? "application/octet-stream" };
    } catch { return null; }
  },
  async deleteFile(id) {
    const { files } = await folders();
    if (!(await inFolder(id, files))) throw new Error("Not found");
    await client().files.update({ fileId: id, requestBody: { trashed: true } });
  },
  async renameFile(id, name) {
    const { files } = await folders();
    if (!(await inFolder(id, files))) throw new Error("Not found");
    await client().files.update({ fileId: id, requestBody: { name } });
    return { id, name };
  },
  async readOtk() {
    const root = process.env.DRIVE_ROOT_FOLDER_ID!;
    const r = await client().files.list({
      q: `'${root}' in parents and name='otk.json' and trashed=false`,
      fields: "files(id)",
    });
    const id = r.data.files?.[0]?.id;
    if (!id) return {};
    try { return JSON.parse(await text(id)); } catch { return {}; }
  },
  async writeOtk(data) {
    const root = process.env.DRIVE_ROOT_FOLDER_ID!;
    const body = () => ({ mimeType: "application/json", body: Readable.from([JSON.stringify(data)]) });
    const r = await client().files.list({
      q: `'${root}' in parents and name='otk.json' and trashed=false`,
      fields: "files(id)",
    });
    const id = r.data.files?.[0]?.id;
    if (id) await client().files.update({ fileId: id, media: body() });
    else await client().files.create({ requestBody: { name: "otk.json", parents: [root] }, media: body() });
  },
};
