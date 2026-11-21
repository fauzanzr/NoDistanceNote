// Pakai: npm run google-token
// Prasyarat: isi GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET di .env.local, dan di Google Cloud Console
// tambahkan Authorized redirect URI: http://localhost:53682/oauth2callback
import fs from "node:fs";
import http from "node:http";
import { google } from "googleapis";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).split("#")[0].trim()]; })
);
if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
  console.error("Isi GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET di .env.local dulu.");
  process.exit(1);
}

const redirect = "http://localhost:53682/oauth2callback";
const oauth = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirect);
const url = oauth.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/drive"],
});

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, redirect);
  if (u.pathname !== "/oauth2callback") return res.end();
  try {
    const { tokens } = await oauth.getToken(u.searchParams.get("code"));
    if (tokens.refresh_token) {
      const envText = fs.readFileSync(".env.local", "utf8");
      const updated = envText.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
      fs.writeFileSync(".env.local", updated);
    }
    res.end("Berhasil! GOOGLE_REFRESH_TOKEN sudah otomatis disimpan ke .env.local. Anda boleh menutup tab ini.");
    console.log("\nGOOGLE_REFRESH_TOKEN sudah otomatis disimpan ke .env.local:\n");
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
  } catch (e) {
    res.end("Gagal: " + e.message);
    console.error(e.message);
  }
  server.close();
});
server.listen(53682, () => console.log("Buka URL ini di browser dan setujui akses:\n\n" + url + "\n"));
