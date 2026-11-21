import { driveStore } from "./drive";
import { localStore } from "./local";
import type { Store } from "./types";

const useDrive = !!(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_REFRESH_TOKEN &&
  process.env.DRIVE_ROOT_FOLDER_ID
);

if (!useDrive && process.env.NODE_ENV === "production") {
  console.warn("[NoDistanceNote] Kredensial Google Drive belum lengkap; memakai penyimpanan lokal (.data).");
}

export const store: Store = useDrive ? driveStore : localStore;
export const storageMode = useDrive ? "drive" : "local";
