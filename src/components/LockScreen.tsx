"use client";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Clock, KeyRound, LockKeyhole, RefreshCw, ShieldAlert, X } from "lucide-react";
import Spinner from "./Spinner";
import BrandIcon from "./BrandIcon";

export type LockReason = "switch" | "idle" | "manual" | "expired" | null;

const REASON_META: Record<
  Exclude<LockReason, null>,
  { title: string; desc: string; Icon: typeof LockKeyhole; tone: string }
> = {
  switch: {
    title: "Session locked automatically",
    desc: "You were away from this tab or app for more than 8 minutes. Unlock again to load the latest synced data.",
    Icon: RefreshCw,
    tone: "bg-accent/10 text-accent",
  },
  idle: {
    title: "Locked due to inactivity",
    desc: "Your session was automatically locked after 15 minutes of inactivity to protect your data.",
    Icon: Clock,
    tone: "bg-amber-500/10 text-amber-500",
  },
  manual: {
    title: "Session locked",
    desc: "Your workspace has been locked. Enter your security key to continue.",
    Icon: LockKeyhole,
    tone: "bg-zinc-200/80 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  },
  expired: {
    title: "Session expired",
    desc: "Your security session has ended. Please verify again to continue.",
    Icon: ShieldAlert,
    tone: "bg-amber-500/10 text-amber-500",
  },
};

// Cahaya lembut yang bergerak + titik-titik berkedip di latar belakang
function Backdrop() {
  const dots = Array.from({ length: 48 }, (_, i) => ({
    left: (i * 37) % 100,
    top: (i * 53 + (i % 5) * 7) % 100,
    delay: ((i * 0.37) % 4).toFixed(2),
    dur: (3 + (i % 5) * 0.8).toFixed(1),
  }));
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="glow glow-a" />
      <div className="glow glow-b" />
      <div className="glow glow-c" />
      {dots.map((d, i) => (
        <span
          key={i}
          className="bg-dot"
          style={{ left: `${d.left}%`, top: `${d.top}%`, animationDelay: `${d.delay}s`, animationDuration: `${d.dur}s` }}
        />
      ))}
    </div>
  );
}

export default function LockScreen({
  pinRequired,
  reason = null,
  onUnlock,
}: {
  pinRequired: boolean;
  reason?: LockReason;
  onUnlock: () => void;
}) {
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");
  const [fail, setFail] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDismissed(false);
    ref.current?.focus();
  }, [reason]);

  async function submit(c: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c, pin }),
      });
      if (r.ok) {
        setLeaving(true);
        setTimeout(onUnlock, 300);
        return;
      }
      const data = (await r.json().catch(() => ({}))) as { error?: string; reason?: string };
      if (r.status === 429) {
        setError(data.error?.trim() || "Too many attempts. Please wait and try again.");
      } else if (r.status === 401) {
        if (data.reason === "expired") {
          setError("OTP code has expired. Please request a new one.");
        } else if (data.reason === "invalid_pin") {
          setError("Invalid Master PIN. Please try again.");
        } else {
          setError(data.error?.trim() || "Invalid OTP code. Please try again.");
        }
      } else {
        setError(data.error?.trim() || "Sign-in failed. Please try again.");
      }
      setFail((f) => f + 1);
      navigator.vibrate?.(200);
      setCode("");
      setBusy(false);
      setTimeout(() => ref.current?.focus(), 0);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setBusy(false);
    }
  }

  function change(v: string) {
    const val = /^\d/.test(v) ? v.replace(/\D/g, "").slice(0, 6) : v.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 8);
    setCode(val);
    setError("");
    const totp = /^\d{6}$/.test(val);
    if ((totp && (!pinRequired || pin)) || /^[A-Z]{8}$/.test(val)) submit(val);
  }

  return (
    <main className="relative isolate flex min-h-screen flex-col items-center px-4">
      <Backdrop />
      {fail > 0 && <div key={fail} className="fail-flash" />}
      <form
        onSubmit={(e) => { e.preventDefault(); if (code) submit(code); }}
        className={`my-auto w-full max-w-sm text-center ${leaving ? "anim-out" : "anim-in"}`}
      >
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-zinc-200/70 bg-zinc-100/90 dark:border-zinc-700/50 dark:bg-zinc-800/90">
          <BrandIcon size={46} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">NoDistanceNote</h1>
        <p className="mt-1 text-sm text-zinc-500">Enter your Dynamic Security Key</p>

        {reason && !dismissed && (() => {
          const { title, desc, Icon, tone } = REASON_META[reason];
          return (
            <div
              role="status"
              className="anim-pop mt-5 flex items-start gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-3 text-left backdrop-blur-md dark:border-zinc-800/90 dark:bg-zinc-900/70"
            >
              <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${tone}`}>
                <Icon size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{desc}</p>
              </div>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                title="Dismiss"
                className="btn -mr-1 -mt-1 !h-6 !w-6 shrink-0"
              >
                <X size={13} />
              </button>
            </div>
          );
        })()}

        <div key={fail} className={`${reason && !dismissed ? "mt-5" : "mt-8"} space-y-3 ${fail > 0 && error ? "anim-shake" : ""}`}>
          {pinRequired && (
            <input
              type="password"
              inputMode="numeric"
              placeholder="Master PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="input text-center"
              autoComplete="off"
            />
          )}
          <div className="relative">
            <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              ref={ref}
              value={code}
              onChange={(e) => change(e.target.value)}
              placeholder="6-digit code / 8-letter key"
              className={`input py-3 text-center font-mono text-lg tracking-[0.3em] placeholder:text-xs placeholder:tracking-normal ${error ? "fail-ring !border-red-400 !ring-2 !ring-red-400/25" : ""
                }`}
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
            />
          </div>
          {error.trim() && (
            <p
              key={error + fail}
              role="alert"
              className="anim-pop mx-auto flex w-fit items-center gap-1.5 rounded-md bg-red-500/10 px-3 py-1.5 text-left text-sm font-medium text-red-500"
            >
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </p>
          )}
          <button className="primary flex h-9 w-full items-center justify-center gap-2" disabled={busy || !code}>
            {busy ? <Spinner size={16} /> : "Unlock"}
          </button>
        </div>
        <p className="mt-6 text-xs text-zinc-400">
          Use the TOTP code from your authenticator app, or a One-Time Key generated on your phone (valid for 3 minutes, single use).
        </p>
      </form>
    </main>
  );
}
