"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, X } from "lucide-react";
import Spinner from "./Spinner";

export function Shell(props: Parameters<typeof ShellInner>[0]) {
  // Portal ke <body>: lepas dari stacking context / transform induk (penyebab modal "tembus" dan tidak menutup sidebar)
  return createPortal(<ShellInner {...props} />, document.body);
}

function ShellInner({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="modal-backdrop fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4" onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={`modal-pop max-h-[90vh] w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 ${wide ? "max-w-xl" : "max-w-sm"}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">{title}</h2>
          <button className="btn" onClick={onClose}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PassphraseModal({
  mode, onSubmit, onClose,
}: {
  mode: "unlock" | "set";
  onSubmit: (pass: string) => Promise<string | void>;
  onClose: () => void;
}) {
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "set" && pass !== confirm) return setErr("Passphrases do not match");
    if (mode === "set" && pass.length < 6) return setErr("Use at least 6 characters");
    setBusy(true);
    const r = await onSubmit(pass);
    setBusy(false);
    if (r) setErr(r);
  }

  return (
    <Shell title={mode === "unlock" ? "Open encrypted note" : "Encrypt note"} onClose={onClose}>
      <form onSubmit={go} className="space-y-3">
        <p className="text-sm text-zinc-500">
          {mode === "unlock"
            ? "Enter your Vault Passphrase to decrypt this note."
            : "Create a Vault Passphrase. If you lose it, this note cannot be recovered."}
        </p>
        <input autoFocus type="password" className="input" placeholder="Vault Passphrase" value={pass} onChange={(e) => { setPass(e.target.value); setErr(""); }} />
        {mode === "set" && (
          <input type="password" className="input" placeholder="Repeat passphrase" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        )}
        {err && <p className="text-sm text-red-500">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary flex h-8 min-w-20 items-center justify-center" disabled={busy || !pass}>
            {busy ? <Spinner size={14} /> : mode === "unlock" ? "Open" : "Encrypt"}
          </button>
        </div>
      </form>
    </Shell>
  );
}

export function ConfirmModal({
  title, message, confirmLabel = "Confirm", danger, onConfirm, onClose,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function go() {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title={title} onClose={onClose}>
      <p className="text-sm leading-relaxed text-zinc-500">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className="ghost" onClick={onClose} disabled={busy}>Cancel</button>
        <button
          type="button"
          onClick={go}
          disabled={busy}
          className={`flex h-8 min-w-20 items-center justify-center rounded-md px-3 text-sm font-medium text-white transition active:scale-95 disabled:opacity-50 ${
            danger ? "bg-red-500 hover:bg-red-600" : "bg-accent hover:bg-accent-dark"
          }`}
        >
          {busy ? <Spinner size={14} /> : confirmLabel}
        </button>
      </div>
    </Shell>
  );
}

export function KeyModal({ onClose }: { onClose: () => void }) {
  const [key, setKey] = useState<{ code: string; expiresAt: number } | null>(null);
  const [err, setErr] = useState("");
  const [left, setLeft] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/auth/one-time-key", { method: "POST" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setKey)
      .catch(() => setErr("Failed to generate key"));
  }, []);

  useEffect(() => {
    if (!key) return;
    const t = setInterval(() => setLeft(Math.max(0, Math.round((key.expiresAt - Date.now()) / 1000))), 500);
    return () => clearInterval(t);
  }, [key]);

  return (
    <Shell title="Access Key for PC" onClose={onClose}>
      {err && <p className="text-sm text-red-500">{err}</p>}
      {!key && !err && <div className="grid place-items-center py-4"><Spinner /></div>}
      {key && (
        <div className="text-center">
          <p className="font-mono text-4xl font-semibold tracking-[0.25em]">{key.code}</p>
          <p className={`mt-3 text-sm ${left === 0 ? "text-red-500" : "text-zinc-500"}`}>
            {left === 0 ? "Expired" : `Valid for ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} · single use`}
          </p>
          <button
            className="ghost mt-4 inline-flex items-center gap-2"
            onClick={() => { navigator.clipboard.writeText(key.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          >
            <Copy size={14} /> {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </Shell>
  );
}
