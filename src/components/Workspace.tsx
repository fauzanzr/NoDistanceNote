"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check, Copy, KeyRound, Lock, LockKeyhole, Menu, Moon, PanelLeftClose, Pin, PinOff,
  Plus, Search, ShieldCheck, ShieldOff, Smartphone, Sun, Trash2, AlertCircle, NotebookPen,
} from "lucide-react";
import { COLORS, type Note } from "@/lib/types";
import { decryptText, encryptText } from "@/lib/crypto";
import Editor from "./Editor";
import { ConfirmModal, KeyModal, PassphraseModal } from "./Modals";
import Spinner, { COPYRIGHT } from "./Spinner";
import FilesView from "./FilesView";
import { FolderOpen, StickyNote } from "lucide-react";

type Active = {
  id: string; title: string; subtitle: string; color: string;
  text: string; pinned: boolean; encrypted: boolean;
};
type Sync = "idle" | "pending" | "saving" | "saved" | "error";

const IDLE_MS = 15 * 60_000;
const DEBOUNCE_MS = 1800;
const OPEN_DELAY_MS = 450;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init });
  if (r.status === 401) throw new Error("UNAUTH");
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`);
  return r.json();
}
const json = (method: string, body: unknown): RequestInit => ({
  method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});

const stamp = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
};

export default function Workspace({ onLock }: { onLock: () => void }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Active | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [needsPass, setNeedsPass] = useState(false);
  const [modal, setModal] = useState<"set" | "key" | "delNote" | "rmEncrypt" | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  const [sync, setSync] = useState<Sync>("idle");
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(true);
  const [dark, setDark] = useState(false);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<"notes" | "files">("notes");

  const cur = useRef<Active | null>(null);
  const vault = useRef<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const selectToken = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, kind });
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);
  const flash = useCallback((m: string) => showToast(m, "ok"), [showToast]);
  const flashErr = useCallback((m: string) => showToast(m, "err"), [showToast]);

  // ---------- Quick Lock & Wipe ----------
  const wipe = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    cur.current = null;
    vault.current = {};
    setNotes([]); setActive(null);
    try { sessionStorage.clear(); } catch { /* ignore */ }
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    onLock();
  }, [onLock]);

  const handleErr = useCallback((e: unknown) => {
    if (e instanceof Error && e.message === "UNAUTH") wipe();
    else flashErr(e instanceof Error ? e.message : "Something went wrong");
  }, [wipe, flashErr]);

  // ---------- Init: sidebar first, no note auto-opened ----------
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setOpen(window.innerWidth >= 768);
    api<Note[]>("/api/notes").then(setNotes).catch(handleErr).finally(() => setLoading(false));
  }, [handleErr]);

  // ---------- Idle auto-lock (15 min) ----------
  useEffect(() => {
    let t = setTimeout(wipe, IDLE_MS);
    const reset = () => { clearTimeout(t); t = setTimeout(wipe, IDLE_MS); };
    const evs = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => { clearTimeout(t); evs.forEach((e) => window.removeEventListener(e, reset)); };
  }, [wipe]);

  // ---------- Ctrl/Cmd + K ----------
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => search.current?.focus(), 50);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // ---------- Save ----------
  const saveNow = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const a = cur.current;
    if (!a) return;
    try {
      setSync("saving");
      let content = a.text;
      if (a.encrypted) {
        const p = vault.current[a.id];
        if (!p) return;
        content = await encryptText(a.text, p);
      }
      const saved = await api<Note>(`/api/notes/${a.id}`, json("PUT", {
        title: a.title, subtitle: a.subtitle, color: a.color,
        content, pinned: a.pinned, encrypted: a.encrypted,
      }));
      setNotes((l) => l.map((n) => (n.id === a.id ? saved : n)));
      if (!timer.current) setSync("saved");
    } catch (e) {
      setSync("error");
      handleErr(e);
    }
  }, [handleErr]);

  const edit = (patch: Partial<Active>, immediate = false) => {
    if (!cur.current) return;
    const n = { ...cur.current, ...patch };
    cur.current = n;
    setActive(n);
    if (immediate) return void saveNow();
    setSync("pending");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(saveNow, DEBOUNCE_MS);
  };

  // ---------- Select / create / delete ----------
  async function select(id: string) {
    if (window.innerWidth < 768) setOpen(false);
    if (cur.current?.id === id && !opening) return;
    const token = ++selectToken.current;
    setPendingId(id);
    setOpening(true);
    setColorOpen(false);
    if (timer.current) await saveNow();
    const n = notes.find((x) => x.id === id);
    if (!n) { setOpening(false); setPendingId(null); return; }
    let text = n.body;
    let locked = false;
    if (n.encrypted) {
      const p = vault.current[id];
      if (p) {
        try { text = await decryptText(n.body, p); } catch { locked = true; }
      } else locked = true;
      if (locked) text = "";
    }
    await sleep(OPEN_DELAY_MS);
    if (token !== selectToken.current) return;
    const a = {
      id, title: n.title, subtitle: n.subtitle, color: n.color,
      text, pinned: n.pinned, encrypted: n.encrypted,
    };
    cur.current = a;
    setActive(a);
    setNeedsPass(locked);
    setSync("idle");
    setOpening(false);
    setPendingId(null);
  }

  async function create() {
    if (timer.current) await saveNow();
    selectToken.current++;
    setOpening(false); setPendingId(null);
    try {
      const n = await api<Note>("/api/notes", json("POST", { title: "Untitled", content: "" }));
      setNotes((l) => [n, ...l]);
      const a = { id: n.id, title: n.title, subtitle: "", color: "", text: "", pinned: false, encrypted: false };
      cur.current = a; setActive(a); setNeedsPass(false); setSync("saved");
      if (window.innerWidth < 768) setOpen(false);
    } catch (e) { handleErr(e); }
  }

  function remove() {
    if (!cur.current) return;
    setModal("delNote");
  }

  async function doRemoveNote() {
    const a = cur.current;
    if (!a) return;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    try {
      await api(`/api/notes/${a.id}`, { method: "DELETE" });
      setNotes((l) => l.filter((n) => n.id !== a.id));
      delete vault.current[a.id];
      cur.current = null; setActive(null); setSync("idle");
      flash("Note moved to Trash");
    } catch (e) { handleErr(e); }
  }

  // Dipanggil dari Files: buat catatan baru dari isi file teks
  async function importNote(title: string, text: string) {
    const n = await api<Note>("/api/notes", json("POST", { title, content: text }));
    setNotes((l) => [n, ...l]);
  }

  // ---------- Encryption ----------
  async function unlock(pass: string) {
    const a = cur.current;
    const n = notes.find((x) => x.id === a?.id);
    if (!a || !n) return;
    try {
      const text = await decryptText(n.body, pass);
      vault.current[a.id] = pass;
      const na = { ...a, text };
      cur.current = na; setActive(na); setNeedsPass(false);
    } catch { return "Incorrect passphrase"; }
  }

  async function setEncryption(pass: string) {
    vault.current[cur.current!.id] = pass;
    setModal(null);
    edit({ encrypted: true }, true);
  }

  function toggleEncrypt() {
    const a = cur.current;
    if (!a) return;
    if (!a.encrypted) return setModal("set");
    setModal("rmEncrypt");
  }

  function doRemoveEncryption() {
    const a = cur.current;
    if (!a) return;
    delete vault.current[a.id];
    edit({ encrypted: false }, true);
    flash("Encryption removed");
  }

  // ---------- Misc ----------
  async function upload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const r = await api<{ url: string }>("/api/assets/upload", { method: "POST", body: fd });
    return r.url;
  }

  async function copyAll() {
    await navigator.clipboard.writeText(cur.current?.text ?? "");
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  function toggleDark() {
    const d = !dark;
    setDark(d);
    document.documentElement.classList.toggle("dark", d);
    try { localStorage.setItem("ndn-theme", d ? "dark" : "light"); } catch { /* ignore */ }
  }

  // ---------- Derived list ----------
  const { pinned, others } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = notes
      .filter((n) => !q || n.title.toLowerCase().includes(q) || n.subtitle.toLowerCase().includes(q) || (!n.encrypted && n.body.toLowerCase().includes(q)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return { pinned: list.filter((n) => n.pinned), others: list.filter((n) => !n.pinned) };
  }, [notes, query]);

  const selectedId = pendingId ?? active?.id;
  const dot = (c: string, size = 10) => (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: COLORS[c] ?? "transparent", border: COLORS[c] ? "none" : "1.5px solid #9b9a9780" }}
    />
  );

  const item = (n: Note) => {
    const live = active?.id === n.id ? active : null;
    return (
      <button
        key={n.id}
        onClick={() => select(n.id)}
        className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${
          selectedId === n.id ? "bg-zinc-200/70 dark:bg-zinc-800" : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60"
        }`}
      >
        <span className="mt-[5px]">{dot(live ? live.color : n.color)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{live ? live.title || "Untitled" : n.title}</span>
          <span className="block text-xs text-zinc-400">{stamp(n.updatedAt)}</span>
        </span>
        {n.encrypted && <Lock size={13} className="mt-1 shrink-0 text-zinc-400" />}
      </button>
    );
  };

  const syncLabel = {
    idle: null,
    pending: <><Spinner size={12} /> Saving…</>,
    saving: <><Spinner size={12} /> Saving…</>,
    saved: <><Check size={13} className="text-emerald-500" /> Saved to Drive</>,
    error: <><AlertCircle size={13} className="text-red-500" /> Error</>,
  }[sync];

  return (
    <div className="anim-in flex h-screen overflow-hidden">
      {open && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 shrink-0 bg-zinc-50 transition-all duration-200 dark:bg-[#202020] md:static ${
          open ? "translate-x-0" : "-translate-x-full md:-ml-64"
        }`}
      >
        <div className="anim-side flex h-full flex-col">
          <div className="flex items-center gap-2 px-4 pb-2 pt-4">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-zinc-200 text-[#37352f] dark:bg-zinc-800 dark:text-zinc-100"><NotebookPen size={15} /></div>
            <span className="font-semibold tracking-tight">NoDistanceNote</span>
            <button className="btn ml-auto" title="Close sidebar" onClick={() => setOpen(false)}><PanelLeftClose size={16} /></button>
          </div>
          <div className="px-3 pb-1 pt-1">
            <div className="relative grid grid-cols-2 rounded-lg bg-zinc-200/60 p-0.5 text-sm dark:bg-zinc-800">
              <span
                className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-md bg-white shadow-sm transition-transform duration-300 ease-out dark:bg-zinc-700"
                style={{ transform: view === "files" ? "translateX(100%)" : "none" }}
              />
              {([["notes", "Notes", StickyNote], ["files", "Files", FolderOpen]] as const).map(([k, l, I]) => (
                <button
                  key={k}
                  onClick={() => { setView(k); if (k === "files" && window.innerWidth < 768) setOpen(false); }}
                  className={`relative z-10 flex items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition-colors active:scale-95 ${view === k ? "" : "text-zinc-500"}`}
                >
                  <I size={14} /> {l}
                </button>
              ))}
            </div>
          </div>
          <div className={`space-y-2 px-3 py-2 ${view === "files" ? "hidden" : ""}`}>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                ref={search} value={query} onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…" className="input pl-8 pr-12"
              />
              <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-zinc-200 px-1 text-[10px] text-zinc-400 dark:border-zinc-700">Ctrl K</kbd>
            </div>
            <button onClick={create} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800"><Plus size={16} /> New Note</button>
            <button
              onClick={() => setModal("key")}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-500 transition hover:border-accent hover:text-accent dark:border-zinc-700 md:hidden"
            >
              <Smartphone size={14} /> Generate PC Key
            </button>
          </div>
          {view === "files" && (
            <div className="anim-in flex-1 px-4 py-4 text-xs leading-relaxed text-zinc-400">
              Upload files from one device and download them from another. Files are stored in your Drive&apos;s <span className="font-medium">files</span> folder.
            </div>
          )}
          <nav className={`min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-2 ${view === "files" ? "hidden" : ""}`}>
            {loading && <div className="grid place-items-center py-6"><Spinner size={22} /></div>}
            {pinned.length > 0 && (
              <section>
                <h3 className="mb-1 flex items-center gap-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400"><Pin size={11} /> Pinned</h3>
                {pinned.map(item)}
              </section>
            )}
            <section>
              {pinned.length > 0 && <h3 className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Recent</h3>}
              {others.map(item)}
              {!loading && !pinned.length && !others.length && (
                <p className="px-3 text-sm text-zinc-400">{query ? "No results." : "No notes yet."}</p>
              )}
            </section>
          </nav>
          <div className="hidden p-3 md:block">
            <button onClick={() => setModal("key")} className="ghost flex w-full items-center gap-2 !px-3 !py-2 text-xs">
              <KeyRound size={14} /> Generate Access Key
            </button>
          </div>
          <p className="px-4 pb-3 text-[11px] text-zinc-400">{COPYRIGHT}</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col" style={{ animationDelay: "120ms" }}>
        <header className="flex h-11 items-center gap-1 px-3">
          {!open && <button className="btn" title="Open sidebar" onClick={() => setOpen(true)}><Menu size={18} /></button>}
          <span className="min-w-0 flex-1 truncate px-1 text-sm text-zinc-500">
            {view === "files" ? "Files" : opening ? "" : active ? active.title || "Untitled" : "NoDistanceNote"}
          </span>
          {view === "notes" && !opening && active && <span className="hidden items-center gap-1.5 whitespace-nowrap text-xs text-zinc-500 sm:flex">{syncLabel}</span>}
          {view === "notes" && !opening && active && !needsPass && (
            <>
              <div className="relative">
                <button className="btn" title="Color tag" onClick={() => setColorOpen((v) => !v)}>{dot(active.color, 12)}</button>
                {colorOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setColorOpen(false)} />
                    <div className="anim-in absolute right-0 top-9 z-50 w-44 rounded-lg border border-zinc-200 bg-white p-2 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Color tag</p>
                      <div className="grid grid-cols-5 gap-2 px-1">
                        <button title="None" onClick={() => { edit({ color: "" }, true); setColorOpen(false); }} className="grid h-6 w-6 place-items-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">{dot("", 14)}</button>
                        {Object.entries(COLORS).map(([k, hex]) => (
                          <button
                            key={k} title={k[0].toUpperCase() + k.slice(1)}
                            onClick={() => { edit({ color: k }, true); setColorOpen(false); }}
                            className={`grid h-6 w-6 place-items-center rounded-full transition hover:scale-110 ${active.color === k ? "ring-2 ring-zinc-400" : ""}`}
                            style={{ background: hex }}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <button className={`btn ${active.pinned ? "btn-on" : ""}`} title={active.pinned ? "Unpin" : "Pin"} onClick={() => edit({ pinned: !active.pinned }, true)}>
                {active.pinned ? <PinOff size={16} /> : <Pin size={16} />}
              </button>
              <button className="btn" title="Copy all text" onClick={copyAll}>{copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}</button>
              <button className={`btn ${active.encrypted ? "btn-on" : ""}`} title={active.encrypted ? "Remove encryption" : "Encrypt note"} onClick={toggleEncrypt}>
                {active.encrypted ? <ShieldCheck size={16} /> : <ShieldOff size={16} />}
              </button>
              <button className="btn hover:!text-red-500" title="Delete (move to Trash)" onClick={remove}><Trash2 size={16} /></button>
            </>
          )}
          <button className="btn" title="Light / Dark" onClick={toggleDark}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
          <button
            onClick={wipe}
            title="Quick Lock & Wipe"
            className="ml-1 flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <LockKeyhole size={14} /> <span className="hidden sm:inline">Quick Lock</span>
          </button>
        </header>

        {view === "files" ? (
          <FilesView onError={flashErr} onNotice={flash} onAuthLost={wipe} onImportNote={importNote} />
        ) : opening ? (
          <div className="grid flex-1 place-items-center"><Spinner size={32} label="Opening note…" /></div>
        ) : !active ? (
          <div className="anim-in grid flex-1 place-items-center p-6 text-center">
            <div>
              <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800"><NotebookPen size={26} /></div>
              <h2 className="text-xl font-semibold">Welcome back</h2>
              <p className="mt-1 text-zinc-500">Choose a note from the sidebar, or create a new one.</p>
              <button onClick={create} className="primary mt-5 inline-flex items-center gap-2"><Plus size={16} /> New Note</button>
            </div>
          </div>
        ) : needsPass ? (
          <div className="grid flex-1 place-items-center p-6 text-center">
            <div>
              <Lock size={32} className="mx-auto mb-3 text-zinc-400" />
              <p className="mb-1 font-medium">This note is encrypted</p>
              <p className="mb-4 text-sm text-zinc-500">Enter your Vault Passphrase to open it.</p>
              <PassphraseModal mode="unlock" onSubmit={unlock} onClose={() => { cur.current = null; setActive(null); setNeedsPass(false); }} />
            </div>
          </div>
        ) : (
          <Editor
            key={active.id}
            value={active.text}
            onChange={(text) => edit({ text })}
            onUpload={upload}
            onError={flashErr}
            header={
              <div className="anim-in mb-4 flex flex-col gap-1 md:flex-row md:items-baseline md:gap-4">
                <input
                  value={active.title}
                  onChange={(e) => edit({ title: e.target.value })}
                  placeholder="Untitled"
                  className="min-w-0 flex-[3] bg-transparent text-4xl font-bold tracking-tight outline-none placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
                />
                <input
                  value={active.subtitle}
                  onChange={(e) => edit({ subtitle: e.target.value })}
                  placeholder="Subtitle"
                  maxLength={200}
                  className="min-w-0 flex-[2] bg-transparent text-2xl font-semibold tracking-tight text-zinc-500 outline-none dark:text-zinc-400 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 md:border-l md:border-zinc-200 md:pl-4 md:dark:border-zinc-700"
                />
              </div>
            }
          />
        )}
      </main>

      {modal === "set" && <PassphraseModal mode="set" onSubmit={async (p) => void setEncryption(p)} onClose={() => setModal(null)} />}
      {modal === "key" && <KeyModal onClose={() => setModal(null)} />}
      {modal === "delNote" && active && (
        <ConfirmModal
          title="Delete note"
          message={<>Move <span className="font-medium text-zinc-800 dark:text-zinc-100">“{active.title || "Untitled"}”</span> to the Google Drive Trash?</>}
          confirmLabel="Delete"
          danger
          onClose={() => setModal(null)}
          onConfirm={doRemoveNote}
        />
      )}
      {modal === "rmEncrypt" && (
        <ConfirmModal
          title="Remove encryption"
          message="Remove encryption? This note will be stored as plain text in Google Drive."
          confirmLabel="Remove"
          danger
          onClose={() => setModal(null)}
          onConfirm={doRemoveEncryption}
        />
      )}
      {toast && (
        <div
          key={toast.msg}
          className="toast-in fixed left-1/2 top-4 z-[110] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-zinc-200/80 bg-white/95 px-3.5 py-2 text-xs font-medium text-zinc-800 shadow-lg backdrop-blur-md dark:border-zinc-700/80 dark:bg-zinc-900/95 dark:text-zinc-100"
        >
          {toast.kind === "err" ? (
            <AlertCircle size={14} className="shrink-0 text-red-500" />
          ) : (
            <Check size={14} className="shrink-0 text-emerald-500" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
