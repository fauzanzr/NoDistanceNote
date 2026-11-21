// Membuat .env.local (mode lokal) bila belum ada, lalu mencetak QR TOTP.
// Pakai: npm run setup   |   npm run totp  (cetak kode TOTP saat ini)
import fs from "node:fs";
import crypto from "node:crypto";
import { authenticator } from "otplib";
import QRCode from "qrcode";

const envPath = ".env.local";
if (!fs.existsSync(envPath)) {
  const body = `# Dikosongkan GOOGLE_* => data disimpan lokal di folder .data (mode dev)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
DRIVE_ROOT_FOLDER_ID=
TOTP_SECRET=${authenticator.generateSecret()}
MASTER_PIN=
JWT_SECRET=${crypto.randomBytes(32).toString("hex")}
`;
  fs.writeFileSync(envPath, body);
  console.log("Dibuat:", envPath);
}

const env = Object.fromEntries(
  fs.readFileSync(envPath, "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).split("#")[0].trim()]; })
);
const secret = env.TOTP_SECRET;
if (!secret) { console.error("TOTP_SECRET kosong di .env.local"); process.exit(1); }

if (process.argv.includes("--code")) {
  console.log("Kode TOTP saat ini:", authenticator.generate(secret));
} else {
  const uri = authenticator.keyuri("owner", "NoDistanceNote", secret);
  await QRCode.toFile("totp-qr.png", uri, { width: 320 });
  console.log("Scan totp-qr.png dengan Google Authenticator / Authy.");
  console.log("Atau input manual secret:", secret);
  console.log("Kode TOTP saat ini:", authenticator.generate(secret));
}
