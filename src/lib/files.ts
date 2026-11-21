// Deteksi perangkat dari User-Agent + helper header unduhan.
export type DeviceInfo = { device: "desktop" | "mobile"; os: string };

export function detectDevice(ua: string): DeviceInfo {
  const mobile = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua);
  let os = "Unknown";
  if (/Windows Phone/i.test(ua)) os = "Windows Phone";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/CrOS/i.test(ua)) os = "ChromeOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  return { device: mobile ? "mobile" : "desktop", os };
}

/** Content-Disposition: attachment standar (ASCII fallback + UTF-8) agar IDM/browser mengenalinya. */
const PREVIEW: Record<string, { mime: string; kind: "image" | "video" | "audio" }> = {
  mp3: { mime: "audio/mpeg", kind: "audio" },
  wav: { mime: "audio/wav", kind: "audio" },
  m4a: { mime: "audio/mp4", kind: "audio" },
  ogg: { mime: "audio/ogg", kind: "audio" },
  oga: { mime: "audio/ogg", kind: "audio" },
  opus: { mime: "audio/ogg", kind: "audio" },
  aac: { mime: "audio/aac", kind: "audio" },
  flac: { mime: "audio/flac", kind: "audio" },
  png: { mime: "image/png", kind: "image" },
  jpg: { mime: "image/jpeg", kind: "image" },
  jpeg: { mime: "image/jpeg", kind: "image" },
  gif: { mime: "image/gif", kind: "image" },
  webp: { mime: "image/webp", kind: "image" },
  bmp: { mime: "image/bmp", kind: "image" },
  avif: { mime: "image/avif", kind: "image" },
  mp4: { mime: "video/mp4", kind: "video" },
  m4v: { mime: "video/mp4", kind: "video" },
  webm: { mime: "video/webm", kind: "video" },
  mov: { mime: "video/quicktime", kind: "video" },
  ogv: { mime: "video/ogg", kind: "video" },
};

/** Tipe yang aman & didukung browser untuk pratinjau inline (SVG sengaja dikecualikan). */
export function previewType(name: string) {
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  return PREVIEW[ext] ?? null;
}
export function attachment(name: string) {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
