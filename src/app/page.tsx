"use client";
import { useEffect, useRef, useState } from "react";
import LockScreen from "@/components/LockScreen";
import Spinner from "@/components/Spinner";
import Workspace from "@/components/Workspace";

export default function Home() {
  const [state, setState] = useState<"loading" | "locking" | "locked" | "open">("loading");
  const [pinRequired, setPinRequired] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    fetch("/api/auth/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((s) => {
        setPinRequired(!!s.pinRequired);
        setState(s.authenticated ? "open" : "locked");
      })
      .catch(() => setState("locked"));
    return () => clearTimeout(t.current);
  }, []);

  // Quick Lock: loading screen di tengah dulu (untuk klik manual), atau langsung masuk halaman kode 6 digit saat pindah tab/browser
  const lock = (immediate = false) => {
    clearTimeout(t.current);
    if (immediate) {
      setState("locked");
      return;
    }
    setState("locking");
    t.current = setTimeout(() => setState("locked"), 1100);
  };

  if (state === "loading" || state === "locking") {
    return <div className="anim-in grid h-screen place-items-center"><Spinner size={34} label={state === "locking" ? "Locking…" : undefined} /></div>;
  }
  if (state === "locked") return <LockScreen pinRequired={pinRequired} onUnlock={() => setState("open")} />;
  return <Workspace onLock={lock} />;
}
