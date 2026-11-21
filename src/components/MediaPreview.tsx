"use client";
import { useState } from "react";
import { Music } from "lucide-react";
import Spinner from "./Spinner";
import { previewType } from "@/lib/files";

/** Pratinjau inline gambar / video / audio. Kontainer selalu opak agar tidak ada elemen di belakang yang "tembus". */
export default function MediaPreview({ id, name }: { id: string; name: string }) {
  const pv = previewType(name);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  if (!pv) return null;
  const src = `/api/files/${encodeURIComponent(id)}?inline=1`;
  const hide = state === "ready" ? "opacity-100" : "opacity-0";

  return (
    <div className="relative mb-4 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
      {state === "loading" && (
        <div className="grid h-36 place-items-center"><Spinner size={22} label="Loading preview…" /></div>
      )}
      {state === "error" && (
        <p className="p-6 text-center text-xs text-zinc-400">
          This {pv.kind} can&apos;t be previewed in your browser. You can still download it.
        </p>
      )}

      {pv.kind === "image" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src} alt={name}
          onLoad={() => setState("ready")} onError={() => setState("error")}
          className={`max-h-80 w-full object-contain transition-opacity duration-300 ${state === "error" ? "hidden" : state === "loading" ? "h-0 opacity-0" : hide}`}
        />
      )}

      {pv.kind === "video" && (
        <video
          src={src} controls playsInline preload="metadata"
          onLoadedMetadata={() => setState("ready")} onError={() => setState("error")}
          className={`max-h-80 w-full bg-black transition-opacity duration-300 ${state === "error" ? "hidden" : state === "loading" ? "h-0 opacity-0" : hide}`}
        />
      )}

      {pv.kind === "audio" && (
        <div className={state === "ready" ? "block" : state === "error" ? "hidden" : "h-0 overflow-hidden opacity-0"}>
          <div className="grid place-items-center pb-1 pt-5 text-zinc-400"><Music size={34} strokeWidth={1.5} /></div>
          <audio
            src={src} controls preload="metadata"
            onLoadedMetadata={() => setState("ready")} onError={() => setState("error")}
            className="w-full p-3"
          />
        </div>
      )}
    </div>
  );
}
