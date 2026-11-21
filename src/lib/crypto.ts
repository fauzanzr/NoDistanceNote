// Enkripsi sisi klien: PBKDF2 (SHA-256) -> AES-256-GCM. Format: iv:salt:ciphertext (Base64).
const enc = new TextEncoder();
const dec = new TextDecoder();
const ITER = 250_000;

const b64 = (b: ArrayBuffer | Uint8Array) => {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  u.forEach((c) => (s += String.fromCharCode(c)));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(pass: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITER, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(plain: string, pass: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(pass, salt);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain));
  return `${b64(iv)}:${b64(salt)}:${b64(ct)}`;
}

export async function decryptText(blob: string, pass: string) {
  const [iv, salt, ct] = blob.trim().split(":");
  if (!iv || !salt || !ct) throw new Error("Format tidak valid");
  const key = await deriveKey(pass, unb64(salt));
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) as BufferSource }, key, unb64(ct) as BufferSource);
  return dec.decode(pt);
}
