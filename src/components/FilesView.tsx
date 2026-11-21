"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, Check, CloudUpload, Download, File as FileIcon, FileArchive, FileCode, FileSpreadsheet,
  FileText, Image as ImageIcon, Info, Monitor, Music, NotebookPen, Pencil, Presentation, Search, Smartphone, Trash2, Video, X,
  type LucideIcon,
} from "lucide-react";
import Spinner from "./Spinner";
import { ConfirmModal, Shell } from "./Modals";
import MediaPreview from "./MediaPreview";

type FileItem = {
  id: string; name: string; size: number; mime: string; createdAt: string;
  device?: string; os?: string; uid?: string;
};
type Upload = { key: string; name: string; size: number; progress: number; speedBps: number; error?: string };
type DownloadState = { progress: number; speedBps: number; abort: () => void };
type StorageInfo = { mode: "drive" | "local"; account: string; path: string };
type Kind = { label: string; Icon: LucideIcon; color: string };

const fmtSize = (b: number) => {
  if (b < 1024) return `${b} B`;
  const u = ["KB", "MB", "GB"];
  let i = -1;
  do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
  return `${b.toFixed(b < 10 ? 1 : 0)} ${u[i]}`;
};
/** Format kecepatan transfer menjadi Mbps & MB/s (atau Kbps & KB/s bila di bawah 1 Mbps). */
const fmtSpeed = (bps: number) => {
  if (!Number.isFinite(bps) || bps <= 0) return "Calculating…";
  const mbps = (bps * 8) / 1_000_000;
  const mbs = bps / (1024 * 1024);
  if (mbps >= 1) {
    return `${mbps.toFixed(mbps < 10 ? 1 : 0)} Mbps · ${mbs.toFixed(mbs < 10 ? 1 : 0)} MB/s`;
  }
  const kbps = Math.max(1, Math.round((bps * 8) / 1_000));
  const kbs = Math.max(1, Math.round(bps / 1024));
  return `${kbps} Kbps · ${kbs} KB/s`;
};
const fmtShort = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
};
const fmtFull = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { dateStyle: "long", timeStyle: "medium" });

const BIG_FILE = 500 * 1024 * 1024; // >= 500 MB perlu konfirmasi
// Ukuran chunk untuk Resumable Upload: 32 MB (kelipatan 256 KB sesuai spesifikasi Google Drive Resumable Upload API)
const DRIVE_CHUNK_SIZE = 32 * 1024 * 1024;
const SERVER_CHUNK_SIZE = 16 * 1024 * 1024;
const MAX_CHUNK_RETRIES = 3;
const MAX_CHARS = 22;
/** Nama tanpa ekstensi, dipotong dengan ellipsis bila terlalu panjang. */
function shortName(name: string, max = MAX_CHARS) {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 && name.length - dot <= 8 ? name.slice(0, dot) : name;
  return base.length <= max ? base : base.slice(0, max - 1) + "…";
}

const SETS: [string[], Kind][] = [
  [["pdf"], { label: "PDF Document", Icon: FileText, color: "#e5484d" }],
  [["doc", "docx", "rtf", "odt"], { label: "Word Document", Icon: FileText, color: "#2b7cd3" }],
  [["xls", "xlsx", "csv", "ods"], { label: "Spreadsheet", Icon: FileSpreadsheet, color: "#2f9e6b" }],
  [["ppt", "pptx", "key", "odp"], { label: "Presentation", Icon: Presentation, color: "#e8803a" }],
  [["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "heic", "avif"], { label: "Image", Icon: ImageIcon, color: "#8e4ec6" }],
  [["zip", "rar", "7z", "tar", "gz", "bz2"], { label: "Archive", Icon: FileArchive, color: "#d9a514" }],
  [["mp4", "mov", "mkv", "avi", "webm"], { label: "Video", Icon: Video, color: "#e255a1" }],
  [["mp3", "wav", "m4a", "flac", "ogg"], { label: "Audio", Icon: Music, color: "#12a594" }],
  [["js", "ts", "tsx", "jsx", "py", "java", "c", "cpp", "html", "css", "json", "xml", "sh"], { label: "Code", Icon: FileCode, color: "#5b6b7f" }],
  [["txt", "md", "log"], { label: "Text", Icon: FileText, color: "#787774" }],
];
const extOf = (n: string) => (n.includes(".") ? n.split(".").pop()!.toLowerCase() : "");
function kindOf(name: string, mime: string): Kind {
  const ext = extOf(name);
  for (const [exts, k] of SETS) if (exts.includes(ext)) return k;
  if (mime.startsWith("image/")) return SETS[4][1];
  if (mime.startsWith("video/")) return SETS[6][1];
  if (mime.startsWith("audio/")) return SETS[7][1];
  return { label: "File", Icon: FileIcon, color: "#9b9a97" };
}

function Tile({ kind, ext, size = 72 }: { kind: Kind; ext: string; size?: number }) {
  return (
    <div
      className="relative grid shrink-0 place-items-center rounded-2xl transition-transform duration-200 group-hover:scale-105"
      style={{ width: size, height: size, background: kind.color + "1f", color: kind.color }}
    >
      <kind.Icon size={size * 0.5} strokeWidth={1.7} />
      {ext && (
        <span
          className="absolute -bottom-1.5 rounded px-1.5 text-[9px] font-bold uppercase tracking-wide text-white"
          style={{ background: kind.color }}
        >
          {ext.slice(0, 5)}
        </span>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2 text-sm">
      <dt className="w-28 shrink-0 text-zinc-400">{label}</dt>
      <dd className="min-w-0 flex-1 break-words font-medium">{children}</dd>
    </div>
  );
}

const TEXT_EXT = ["txt", "md", "markdown", "text", "log", "csv"];
const isText = (n: string) => TEXT_EXT.includes(extOf(n));

/** Ganti nama: hanya bagian nama yang diedit, ekstensi asli dipertahankan otomatis. */
function NameEditor({ file, onRename }: { file: FileItem; onRename: (name: string) => Promise<void> }) {
  const dot = file.name.lastIndexOf(".");
  const hasExt = dot > 0 && file.name.length - dot <= 8;
  const ext = hasExt ? file.name.slice(dot + 1) : "";
  const base = hasExt ? file.name.slice(0, dot) : file.name;
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(base);

  function save() {
    let v = val.trim();
    if (ext && v.toLowerCase().endsWith("." + ext.toLowerCase())) v = v.slice(0, -(ext.length + 1)).trim();
    setEditing(false);
    if (!v || v === base) return;
    void onRename(ext ? `${v}.${ext}` : v);
  }

  if (!editing) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <p className="min-w-0 break-words text-sm font-semibold">{file.name}</p>
        <button className="btn shrink-0" title="Rename" onClick={() => { setVal(base); setEditing(true); }}><Pencil size={14} /></button>
      </div>
    );
  }
  return (
    <form className="flex min-w-0 flex-1 items-center gap-1" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <input
        autoFocus value={val} onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
        className="input min-w-0 flex-1 !py-1" maxLength={150}
      />
      {ext && <span className="shrink-0 text-sm text-zinc-400">.{ext}</span>}
      <button className="btn shrink-0" type="submit" title="Save"><Check size={16} /></button>
      <button className="btn shrink-0" type="button" title="Cancel" onClick={() => setEditing(false)}><X size={16} /></button>
    </form>
  );
}

function RenameModal({
  file, onClose, onSubmit,
}: { file: FileItem; onClose: () => void; onSubmit: (name: string) => Promise<void> | void }) {
  const dot = file.name.lastIndexOf(".");
  const hasExt = dot > 0 && file.name.length - dot <= 8;
  const ext = hasExt ? file.name.slice(dot + 1) : "";
  const base = hasExt ? file.name.slice(0, dot) : file.name;
  const [val, setVal] = useState(base);

  function save(e: React.FormEvent) {
    e.preventDefault();
    let v = val.trim();
    if (ext && v.toLowerCase().endsWith("." + ext.toLowerCase())) v = v.slice(0, -(ext.length + 1)).trim();
    onClose();
    if (!v || v === base) return;
    void onSubmit(ext ? `${v}.${ext}` : v);
  }

  return (
    <Shell title="Rename file" onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <div className="flex items-center gap-1.5">
          <input
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="input min-w-0 flex-1"
            placeholder="File name"
            maxLength={150}
          />
          {ext && <span className="shrink-0 rounded-md bg-zinc-100 px-2.5 py-1.5 text-sm font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">.{ext}</span>}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary flex min-w-20 items-center justify-center" disabled={!val.trim()}>
            Save
          </button>
        </div>
      </form>
    </Shell>
  );
}

export default function FilesView({
  onError, onNotice, onAuthLost, onImportNote, onUploadingChange,
}: {
  onError: (m: string) => void;
  onNotice: (m: string) => void;
  onAuthLost: () => void;
  onImportNote: (title: string, text: string) => Promise<void>;
  onUploadingChange?: (activeCount: number) => void;
}) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [drag, setDrag] = useState(false);
  const [detail, setDetail] = useState<FileItem | null>(null);
  const [renaming, setRenaming] = useState<FileItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FileItem[] | null>(null);
  const [pending, setPending] = useState<File[] | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const dragDepth = useRef(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const activeUploadCount = uploads.filter((u) => !u.error && u.progress < 100).length;
    const activeDownloadCount = Object.keys(downloads).length;
    onUploadingChange?.(activeUploadCount + activeDownloadCount);
  }, [uploads, downloads, onUploadingChange]);

  useEffect(() => {
    fetch("/api/files", { cache: "no-store" })
      .then((r) => {
        if (r.status === 401) { onAuthLost(); throw new Error(); }
        return r.json();
      })
      .then((list: FileItem[]) => setFiles(list.map((f) => ({ ...f, uid: f.uid ?? f.id }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [onAuthLost]);

  const loadStorage = () => {
    if (storage) return;
    fetch("/api/files/info", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s && setStorage(s))
      .catch(() => {});
  };
  const openDetail = (f: FileItem) => {
    setDetail(f);
    loadStorage();
  };

  const patchUpload = (key: string, p: Partial<Upload>) =>
    setUploads((u) => u.map((x) => (x.key === key ? { ...x, ...p } : x)));

  const upload = useCallback((file: File) => {
    const key = `${Date.now()}-${Math.random()}`;
    setUploads((u) => [{ key, name: file.name, size: file.size, progress: 0, speedBps: 0 }, ...u]);

    // Tracker kecepatan upload real-time (exponential moving average) lintas chunk
    let lastTime = performance.now();
    let lastBytes = 0;
    let emaBps = 0;
    const updateProgress = (loadedBytes: number, totalBytes: number) => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      if (dt >= 0.2) {
        const inst = Math.max(0, (loadedBytes - lastBytes) / dt);
        emaBps = emaBps === 0 ? inst : emaBps * 0.6 + inst * 0.4;
        lastTime = now;
        lastBytes = loadedBytes;
      }
      const pct = totalBytes > 0 ? Math.min(99, Math.round((loadedBytes / totalBytes) * 100)) : 99;
      patchUpload(key, { progress: pct, speedBps: Math.round(emaBps) });
    };

    const finish = (item: FileItem) => {
      patchUpload(key, { progress: 100 });
      setTimeout(() => {
        setFiles((f) => [{ ...item, uid: item.id }, ...f]);
        setUploads((u) => u.filter((x) => x.key !== key));
      }, 450);
    };

    const fallbackServerUpload = async () => {
      // Gunakan chunked upload ke /api/files agar file > 1 GB tidak terkena batas memori FormData/Buffer
      const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const total = file.size;
      const mime = file.type || "application/octet-stream";
      let offset = 0;

      while (offset < total || total === 0) {
        const end = total === 0 ? 0 : Math.min(offset + SERVER_CHUNK_SIZE, total);
        const chunk = file.slice(offset, end);

        const res = await new Promise<{ status: number; text: string }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", "/api/files");
          xhr.setRequestHeader("Content-Type", "application/octet-stream");
          xhr.setRequestHeader("x-upload-id", uploadId);
          xhr.setRequestHeader("x-file-name", encodeURIComponent(file.name));
          xhr.setRequestHeader("x-file-mime", mime);
          xhr.setRequestHeader("x-chunk-offset", String(offset));
          xhr.setRequestHeader("x-file-size", String(total));
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable && total > 0) {
              updateProgress(offset + e.loaded, total);
            }
          };
          xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText });
          xhr.onerror = () => reject(new Error("Network error"));
          xhr.send(chunk);
        }).catch((err: unknown) => {
          patchUpload(key, { error: err instanceof Error ? err.message : "Network error" });
          return null;
        });

        if (!res) return;
        if (res.status === 401) {
          onAuthLost();
          return;
        }
        if (res.status >= 200 && res.status < 300) {
          let body: Record<string, unknown> = {};
          try { body = JSON.parse(res.text || "{}"); } catch { /* ignore */ }
          if (!body.partial) {
            finish(body as unknown as FileItem);
            return;
          }
          offset = end;
          if (total === 0) break;
        } else {
          let msg = "Upload failed";
          try { msg = JSON.parse(res.text).error ?? msg; } catch { /* ignore */ }
          patchUpload(key, { error: msg });
          return;
        }
      }
    };

    const uploadToDriveResumable = async (sess: {
      uploadUrl: string;
      name?: string;
      device?: string;
      os?: string;
    }) => {
      const total = file.size;
      const mime = file.type || "application/octet-stream";
      let offset = 0;

      // Query posisi byte terakhir yang diterima Google Drive saat terjadi gangguan jaringan
      const queryResumeOffset = (): Promise<number | null> =>
        new Promise((resolve) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", sess.uploadUrl);
          xhr.setRequestHeader("Content-Range", `bytes */${total}`);
          xhr.onload = () => {
            if (xhr.status === 308) {
              const range = xhr.getResponseHeader("Range");
              const m = range && /bytes=0-(\d+)/i.exec(range);
              resolve(m ? parseInt(m[1], 10) + 1 : 0);
            } else {
              resolve(null);
            }
          };
          xhr.onerror = () => resolve(null);
          xhr.send();
        });

      while (offset < total || total === 0) {
        const end = total === 0 ? 0 : Math.min(offset + DRIVE_CHUNK_SIZE, total);
        const chunk = file.slice(offset, end);
        let attempt = 0;
        let chunkDone = false;

        while (attempt < MAX_CHUNK_RETRIES && !chunkDone) {
          attempt++;
          const res = await new Promise<{ status: number; text: string; range: string | null }>((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", sess.uploadUrl);
            xhr.setRequestHeader("Content-Type", mime);
            if (total > 0) {
              xhr.setRequestHeader("Content-Range", `bytes ${offset}-${end - 1}/${total}`);
            }
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable && total > 0) {
                updateProgress(offset + e.loaded, total);
              }
            };
            xhr.onload = () =>
              resolve({
                status: xhr.status,
                text: xhr.responseText,
                range: xhr.getResponseHeader("Range"),
              });
            xhr.onerror = () => resolve({ status: 0, text: "", range: null });
            xhr.send(chunk);
          });

          if (res.status >= 200 && res.status < 300) {
            let meta: Record<string, unknown> = {};
            try { meta = JSON.parse(res.text || "{}"); } catch { /* ignore */ }
            const appProps = (meta.appProperties ?? {}) as Record<string, string>;
            finish({
              id: String(meta.id ?? `${Date.now()}`),
              name: String(meta.name ?? sess.name ?? file.name),
              size: Number(meta.size ?? file.size),
              mime: String(meta.mimeType ?? file.type ?? "application/octet-stream"),
              createdAt: String(meta.createdTime ?? new Date().toISOString()),
              device: appProps.device ?? sess.device,
              os: appProps.os ?? sess.os,
            });
            return;
          }

          if (res.status === 308) {
            // Chunk berhasil diterima oleh Google Drive, lanjutkan ke chunk berikutnya
            const m = res.range && /bytes=0-(\d+)/i.exec(res.range);
            offset = m ? parseInt(m[1], 10) + 1 : end;
            updateProgress(offset, total);
            chunkDone = true;
            break;
          }

          // Jika gagal karena masalah jaringan sementara atau 5xx/429, coba resume
          if ((res.status === 0 || res.status === 429 || res.status >= 500) && attempt < MAX_CHUNK_RETRIES) {
            await new Promise((r) => setTimeout(r, 1000 * attempt));
            if (total > 0) {
              const resumed = await queryResumeOffset();
              if (resumed !== null) {
                offset = resumed;
                chunkDone = true;
                break;
              }
            }
            continue;
          }

          patchUpload(key, {
            error: res.status ? `Drive upload failed (${res.status})` : "Direct upload network error",
          });
          return;
        }

        if (!chunkDone) {
          patchUpload(key, { error: "Upload interrupted after multiple retries" });
          return;
        }
        if (total === 0) break;
      }
    };

    // Coba Direct Resumable Upload ke Google Drive terlebih dahulu (lolos batas 4.5 MB Vercel & mendukung > 1 GB)
    fetch("/api/files/upload-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: file.name, mime: file.type || "application/octet-stream", size: file.size }),
    })
      .then(async (r) => {
        if (r.status === 401) { onAuthLost(); return null; }
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error ?? "Upload failed");
        }
        return r.json();
      })
      .then((sess) => {
        if (!sess) return;
        if (sess.mode !== "direct" || !sess.uploadUrl) {
          void fallbackServerUpload();
          return;
        }
        void uploadToDriveResumable(sess);
      })
      .catch((e) => {
        patchUpload(key, { error: e instanceof Error ? e.message : "Upload failed" });
      });
  }, [onAuthLost]);

  // < 500 MB langsung diunggah; >= 500 MB menunggu konfirmasi "Yes, Do it."
  const pick = (list: FileList | File[] | null) => {
    const big: File[] = [];
    for (const f of Array.from(list ?? [])) (f.size >= BIG_FILE ? big.push(f) : upload(f));
    if (big.length) { loadStorage(); setPending(big); }
  };

  // Direct Download dari Google Drive (atau streaming server) dengan progress bar (%) & kecepatan (Mbps)
  const downloadFile = useCallback(async (f: FileItem) => {
    if (downloads[f.id]) return;
    const ctrl = new AbortController();
    const removeDl = () =>
      setDownloads((d) => {
        const next = { ...d };
        delete next[f.id];
        return next;
      });

    setDownloads((d) => ({
      ...d,
      [f.id]: { progress: 0, speedBps: 0, abort: () => ctrl.abort() },
    }));

    try {
      const sessRes = await fetch(`/api/files/${encodeURIComponent(f.id)}?session=1`, {
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (sessRes.status === 401) {
        removeDl();
        onAuthLost();
        return;
      }
      if (!sessRes.ok) throw new Error("Failed to start download");
      const sess = (await sessRes.json()) as {
        mode: "direct" | "server";
        url: string;
        token?: string;
        name: string;
        size: number;
        mime: string;
      };

      const res = await fetch(sess.url, {
        headers: sess.token ? { Authorization: `Bearer ${sess.token}` } : undefined,
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`Download failed (${res.status})`);

      const total = Number(res.headers.get("Content-Length") || sess.size || f.size || 0);
      const reader = res.body.getReader();
      const blobParts: BlobPart[] = [];
      let ramChunks: Uint8Array[] = [];
      let ramBytes = 0;
      let loaded = 0;
      let lastTime = performance.now();
      let lastBytes = 0;
      let emaBps = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          ramChunks.push(value);
          ramBytes += value.byteLength;
          loaded += value.byteLength;

          // Konsolidasi setiap 16 MB menjadi Blob agar browser memindahkan buffer dari JS heap ke disk cache
          if (ramBytes >= 16 * 1024 * 1024) {
            blobParts.push(new Blob(ramChunks as BlobPart[]));
            ramChunks = [];
            ramBytes = 0;
          }

          const now = performance.now();
          const dt = (now - lastTime) / 1000;
          if (dt >= 0.2) {
            const inst = Math.max(0, (loaded - lastBytes) / dt);
            emaBps = emaBps === 0 ? inst : emaBps * 0.6 + inst * 0.4;
            lastTime = now;
            lastBytes = loaded;
            const pct = total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 50;
            setDownloads((d) =>
              d[f.id] ? { ...d, [f.id]: { ...d[f.id], progress: pct, speedBps: Math.round(emaBps) } } : d
            );
          }
        }
      }

      if (ramChunks.length > 0) {
        blobParts.push(new Blob(ramChunks as BlobPart[]));
        ramChunks = [];
      }

      setDownloads((d) =>
        d[f.id] ? { ...d, [f.id]: { ...d[f.id], progress: 100, speedBps: Math.round(emaBps) } } : d
      );

      const finalBlob = new Blob(blobParts, { type: sess.mime || "application/octet-stream" });
      const blobUrl = URL.createObjectURL(finalBlob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = sess.name || f.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      setTimeout(removeDl, 500);
      onNotice(`Downloaded “${sess.name || f.name}”`);
    } catch (e) {
      removeDl();
      if (ctrl.signal.aborted) {
        onNotice("Download canceled");
        return;
      }
      onError(e instanceof Error ? e.message : "Download failed");
    }
  }, [downloads, onAuthLost, onError, onNotice]);

  function removeMany(list: FileItem[]) {
    if (!list.length) return;
    setConfirmDelete(list);
  }

  async function doRemoveMany(list: FileItem[]) {
    for (const f of list) {
      const r = await fetch(`/api/files/${encodeURIComponent(f.id)}`, { method: "DELETE" }).catch(() => null);
      if (r?.status === 401) return onAuthLost();
      if (!r?.ok) { onError(`Failed to delete "${f.name}"`); continue; }
      setRemoving((s) => new Set(s).add(f.id));
      setSelected((s) => { const n = new Set(s); n.delete(f.id); return n; });
      setTimeout(() => {
        setFiles((l) => l.filter((x) => x.id !== f.id));
        setRemoving((s) => { const n = new Set(s); n.delete(f.id); return n; });
      }, 280);
    }
    onNotice(list.length === 1 ? "Moved to Trash" : `${list.length} files moved to Trash`);
  }

  async function importToNotes(f: FileItem) {
    if (f.size > 2 * 1024 * 1024) return onError("File is too large to import as a note (max 2 MB)");
    const r = await fetch(`/api/files/${encodeURIComponent(f.id)}`, { cache: "no-store" }).catch(() => null);
    if (r?.status === 401) return onAuthLost();
    if (!r?.ok) return onError("Could not read the file");
    const text = await r.text();
    if (text.includes("\u0000")) return onError("This file doesn't look like plain text");
    const dot = f.name.lastIndexOf(".");
    const title = (dot > 0 ? f.name.slice(0, dot) : f.name) || "Untitled";
    try {
      await onImportNote(title, text);
      onNotice(`Saved to Notes: “${title}”`);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Import failed");
    }
  }

  async function renameFile(f: FileItem, name: string) {
    const uid = f.uid ?? f.id;
    // Optimistic update: langsung perbarui nama tanpa mengubah uid (key React tetap sama => tidak ada kedip/animasi ulang)
    const optimistic = { ...f, uid, name };
    setFiles((l) => l.map((x) => ((x.uid ?? x.id) === uid ? optimistic : x)));
    setDetail((d) => (d && (d.uid ?? d.id) === uid ? optimistic : d));

    const r = await fetch(`/api/files/${encodeURIComponent(f.id)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
    }).catch(() => null);
    if (r?.status === 401) return onAuthLost();
    if (!r?.ok) {
      // Rollback jika gagal
      setFiles((l) => l.map((x) => ((x.uid ?? x.id) === uid ? f : x)));
      setDetail((d) => (d && (d.uid ?? d.id) === uid ? f : d));
      return onError((await r?.json().catch(() => null))?.error ?? "Rename failed");
    }
    const { id, name: newName } = (await r.json()) as { id: string; name: string };
    const upd = { ...f, uid, id, name: newName };
    setFiles((l) => l.map((x) => ((x.uid ?? x.id) === uid ? upd : x)));
    setSelected((s) => { if (!s.has(f.id)) return s; const n = new Set(s); n.delete(f.id); n.add(id); return n; });
    setDetail((d) => (d && (d.uid ?? d.id) === uid ? upd : d));
    onNotice("File renamed");
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? files.filter((f) => f.name.toLowerCase().includes(q)) : files;
  }, [files, query]);

  const toggle = (id: string) =>
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allShownSelected = shown.length > 0 && shown.every((f) => selected.has(f.id));
  const selList = files.filter((f) => selected.has(f.id));
  const zipHref = `/api/files/zip?ids=${selList.map((f) => encodeURIComponent(f.id)).join(",")}`;

  return (
    <div
      className="anim-in relative flex min-h-0 flex-1 flex-col overflow-hidden"
      onDragEnter={(e) => { e.preventDefault(); dragDepth.current++; setDrag(true); }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => { if (--dragDepth.current <= 0) { dragDepth.current = 0; setDrag(false); } }}
      onDrop={(e) => { e.preventDefault(); dragDepth.current = 0; setDrag(false); pick(e.dataTransfer.files); }}
    >
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-4 pb-3 pt-3 sm:px-6 md:pt-6">
        {/* Header (static) */}
        <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Files</h1>
            <p className="mt-1 text-sm text-zinc-500">Move files between your PC and phone.</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files…"
              className="input pl-8 pr-8"
            />
            {query && (
              <button className="btn absolute right-1 top-1/2 !h-6 !w-6 -translate-y-1/2" onClick={() => setQuery("")} title="Clear"><X size={13} /></button>
            )}
          </div>
        </div>

        {/* Upload area (static) */}
        <button
          onClick={() => input.current?.click()}
          className={`mt-4 flex w-full shrink-0 flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-all duration-200 active:scale-[0.99] ${
            drag
              ? "scale-[1.01] border-accent bg-accent/5 text-accent"
              : "border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
          }`}
        >
          <CloudUpload size={26} className={`transition-transform duration-200 ${drag ? "-translate-y-1" : ""}`} />
          <span className="text-sm font-medium">{drag ? "Drop files to upload" : "Click to choose files, or drag & drop here"}</span>
          <span className="text-xs text-zinc-400">No file size limit (resumable chunked upload) · files of 500 MB or more need confirmation</span>
        </button>
        <input ref={input} type="file" multiple hidden onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />

        {/* Selection bar */}
        <div className="mt-3 flex min-h-9 shrink-0 flex-wrap items-center gap-2 text-sm">
          {selected.size > 0 ? (
            <div className="anim-in flex w-full flex-wrap items-center gap-2">
              <span className="font-medium">{selected.size} selected</span>
              <button className="ghost !px-2 !py-1 text-xs" onClick={() => setSelected(allShownSelected ? new Set() : new Set(shown.map((f) => f.id)))}>
                {allShownSelected ? "Deselect all" : "Select all"}
              </button>
              <button className="ghost !px-2 !py-1 text-xs" onClick={() => setSelected(new Set())}>Clear</button>
              <div className="ml-auto flex items-center gap-2">
                {selected.size > 1 && (
                  <a
                    href={zipHref}
                    download
                    onClick={() => onNotice("ZIP download started — check your browser or download manager")}
                    className="primary inline-flex items-center gap-1.5 !py-1.5 text-xs"
                  >
                    <FileArchive size={14} /> Download Selected as ZIP
                  </a>
                )}
                <button
                  onClick={() => removeMany(selList)}
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-500/10 active:scale-95"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ) : (
            <span className="text-xs text-zinc-400">
              {loading ? "" : `${shown.length} ${shown.length === 1 ? "file" : "files"}${query ? ` matching “${query}”` : ""}`}
            </span>
          )}
        </div>

        {/* File browser: only this container scrolls (horizontally) */}
        <div
          className="no-scrollbar-y mt-1 min-h-0 flex-1 overflow-y-hidden overflow-x-auto"
          onWheel={(e) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY;
          }}
        >
          <div className="flex h-full min-w-full items-start gap-3 py-2 pr-2">
            {uploads.map((u) => (
              <div key={u.key} className="anim-in flex h-60 w-44 shrink-0 flex-col items-center gap-3 overflow-hidden rounded-xl border border-zinc-200 px-3 pb-4 pt-5 dark:border-zinc-700">
                <div className="grid h-[72px] w-[72px] place-items-center rounded-2xl bg-accent/10 text-accent">
                  {u.error ? <AlertCircle size={34} className="text-red-500" /> : <CloudUpload size={34} />}
                </div>
                <p className="w-full truncate text-center text-sm font-medium" title={u.name}>{shortName(u.name)}</p>
                {u.error ? (
                  <>
                    <p className="text-center text-xs text-red-500">{u.error}</p>
                    <button className="ghost !px-2 !py-1 text-xs" onClick={() => setUploads((x) => x.filter((y) => y.key !== u.key))}>Dismiss</button>
                  </>
                ) : (
                  <div className="w-full">
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                      <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${u.progress}%` }} />
                    </div>
                    <p className="mt-1.5 text-center text-xs font-medium tabular-nums text-zinc-600 dark:text-zinc-300">Uploading {u.progress}%</p>
                    <p className="mt-0.5 truncate text-center text-[11px] tabular-nums text-zinc-400">{fmtSpeed(u.speedBps)}</p>
                  </div>
                )}
              </div>
            ))}

            {loading && <div className="grid w-full place-items-center py-10"><Spinner size={26} /></div>}

            {shown.map((f) => {
              const kind = kindOf(f.name, f.mime);
              const sel = selected.has(f.id);
              const dl = downloads[f.id];
              return (
                <div
                  key={f.uid ?? f.id}
                  className={`group relative flex h-60 w-44 shrink-0 flex-col items-center gap-3 overflow-hidden rounded-xl border px-3 pb-3 pt-5 transition-all duration-300 ${
                    removing.has(f.id) ? "scale-90 opacity-0" : "anim-in"
                  } ${sel
                    ? "border-accent bg-accent/5"
                    : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"}`}
                >
                  <button
                    onClick={() => toggle(f.id)}
                    title={sel ? "Deselect" : "Select"}
                    className={`absolute left-2 top-2 grid h-5 w-5 place-items-center rounded-md border transition-all ${
                      sel ? "border-accent bg-accent text-white" : "border-zinc-300 bg-white/70 text-transparent opacity-70 hover:opacity-100 dark:border-zinc-600 dark:bg-zinc-900/60"
                    }`}
                  >
                    <Check size={13} strokeWidth={3} />
                  </button>
                  <button onClick={() => toggle(f.id)} className="mt-1 focus:outline-none" tabIndex={-1}>
                    <Tile kind={kind} ext={extOf(f.name)} />
                  </button>
                  <div className="w-full text-center">
                    <p className="truncate text-sm font-medium" title={f.name}>{shortName(f.name)}</p>
                    <p className="mt-1 text-xs text-zinc-400">{fmtSize(f.size)}</p>
                    {!dl && <p className="text-[11px] text-zinc-400">{fmtShort(f.createdAt)}</p>}
                  </div>
                  {dl ? (
                    <div className="mt-auto w-full">
                      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                        <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${dl.progress}%` }} />
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-1">
                        <span className="text-[11px] font-medium tabular-nums text-zinc-600 dark:text-zinc-300">
                          Downloading {dl.progress}%
                        </span>
                        <button
                          type="button"
                          onClick={dl.abort}
                          title="Cancel download"
                          className="rounded p-0.5 text-zinc-400 transition hover:bg-zinc-200 hover:text-red-500 dark:hover:bg-zinc-800"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <p className="truncate text-[10px] tabular-nums text-zinc-400">{fmtSpeed(dl.speedBps)}</p>
                    </div>
                  ) : (
                    <div className="mt-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void downloadFile(f)}
                        title="Download"
                        className="btn"
                      >
                        <Download size={16} />
                      </button>
                      <button className="btn" title="Details" onClick={() => openDetail(f)}><Info size={16} /></button>
                      <button className="btn" title="Rename" onClick={() => setRenaming(f)}><Pencil size={16} /></button>
                      {isText(f.name) && (
                        <button className="btn" title="Save to Notes" onClick={() => importToNotes(f)}><NotebookPen size={16} /></button>
                      )}
                      <button className="btn hover:!text-red-500" title="Delete" onClick={() => removeMany([f])}><Trash2 size={16} /></button>
                    </div>
                  )}
                </div>
              );
            })}

            {!loading && !shown.length && !uploads.length && (
              <p className="anim-in w-full py-10 text-center text-sm text-zinc-400">
                {query ? `No files match “${query}”.` : "No files yet. Upload something to get started."}
              </p>
            )}
          </div>
        </div>
      </div>

      {drag && <div className="pointer-events-none absolute inset-2 rounded-xl border-2 border-dashed border-accent/60 bg-accent/5" />}

      {pending && (
        <Shell title="Large file upload" onClose={() => setPending(null)}>
          <p className="text-sm leading-relaxed text-zinc-500">
            {pending.length === 1 ? "This file is" : `These ${pending.length} files are`} <span className="font-medium text-zinc-800 dark:text-zinc-100">over 500 MB</span> and will be uploaded to{" "}
            {storage?.mode === "local" ? "local storage" : "Google Drive"}{" "}
            {storage ? (
              <span className="font-medium text-zinc-800 dark:text-zinc-100">{storage.account} <span className="font-normal text-zinc-400">({storage.path})</span></span>
            ) : <span className="inline-block align-middle"><Spinner size={12} /></span>}
            . Do you have enough storage space?
          </p>
          <ul className="mt-3 max-h-32 space-y-1 overflow-y-auto rounded-lg bg-zinc-50 p-2 text-xs dark:bg-zinc-800/60">
            {pending.map((f, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="truncate" title={f.name}>{shortName(f.name, 30)}</span>
                <span className="shrink-0 text-zinc-400">{fmtSize(f.size)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end gap-2">
            <button className="ghost" onClick={() => setPending(null)}>Cancel</button>
            <button className="primary" onClick={() => { pending.forEach(upload); setPending(null); }}>Yes, Do it.</button>
          </div>
        </Shell>
      )}

      {renaming && (
        <RenameModal
          file={renaming}
          onClose={() => setRenaming(null)}
          onSubmit={(newName) => renameFile(renaming, newName)}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title={confirmDelete.length === 1 ? "Delete file" : "Delete files"}
          message={
            confirmDelete.length === 1
              ? <>Move <span className="font-medium text-zinc-800 dark:text-zinc-100">“{confirmDelete[0].name}”</span> to the Trash?</>
              : <>Move <span className="font-medium text-zinc-800 dark:text-zinc-100">{confirmDelete.length} selected files</span> to the Trash?</>
          }
          confirmLabel="Delete"
          danger
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => doRemoveMany(confirmDelete)}
        />
      )}

      {detail && (
        <Shell title="File details" onClose={() => setDetail(null)} wide>
          <MediaPreview key={detail.uid ?? detail.id} id={detail.id} name={detail.name} />
          <div className="mb-3 flex items-center gap-3">
            <Tile kind={kindOf(detail.name, detail.mime)} ext="" size={48} />
            <NameEditor key={detail.uid ?? detail.id} file={detail} onRename={(n) => renameFile(detail, n)} />
          </div>
          <dl className="divide-y divide-zinc-200 dark:divide-zinc-700">
            <Row label="Uploaded">{fmtFull(detail.createdAt)}</Row>
            <Row label="Source device">
              <span className="inline-flex items-center gap-1.5">
                {detail.device === "mobile" ? <Smartphone size={15} /> : detail.device === "desktop" ? <Monitor size={15} /> : null}
                {detail.device === "mobile" ? "Mobile / Phone" : detail.device === "desktop" ? "Desktop / Laptop" : "Unknown"}
                {detail.os && detail.os !== "Unknown" && <span className="font-normal text-zinc-400">· {detail.os}</span>}
              </span>
            </Row>
            <Row label="Size">{fmtSize(detail.size)} <span className="font-normal text-zinc-400">({detail.size.toLocaleString("en-US")} bytes)</span></Row>
            <Row label="Type">
              {kindOf(detail.name, detail.mime).label}
              {extOf(detail.name) && <span className="font-normal text-zinc-400"> .{extOf(detail.name)}</span>}
              {detail.mime && <span className="block text-xs font-normal text-zinc-400">{detail.mime}</span>}
            </Row>
            <Row label="Storage">
              {storage ? (
                <>
                  <span className="block">{storage.account}</span>
                  <span className="block text-xs font-normal text-zinc-400">{storage.path}</span>
                </>
              ) : <Spinner size={14} />}
            </Row>
          </dl>
          {isText(detail.name) && (
            <button className="ghost mt-3 flex items-center gap-2 border border-zinc-200 dark:border-zinc-700" onClick={() => importToNotes(detail)}>
              <NotebookPen size={15} /> Save to Notes
            </button>
          )}
        </Shell>
      )}
    </div>
  );
}
