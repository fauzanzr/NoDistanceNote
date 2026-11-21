# NoDistanceNote

A lightweight, minimalist personal notes web application synced directly to your **Google Drive**, designed for quick and secure access from shared or public devices (office laptops, campus PCs) without signing in to your Google account.

## Overview

**NoDistanceNote** acts as a private bridge between your browser and a dedicated folder in your Google Drive. Instead of logging into Google on untrusted machines, you unlock your workspace using a **Dynamic Security Key** (6-digit TOTP or a one-time access key). All notes are stored as plain Markdown (`.md`) files directly in your Drive.

## Key Features

- **No Google Login on Public Devices:** Server-side Google Drive API integration keeps your Google credentials off the browser.
- **Dynamic Security Key:** Unlock via 6-digit TOTP (Authenticator app) or a temporary One-Time Key generated from your phone, paired with session auto-lock and a **Quick Lock & Wipe** button.
- **Auto-Save & Sync Indicator:** Real-time syncing to Google Drive with live save status.
- **Markdown Editor & Toolbar:** Clean writing experience with formatting shortcuts, checklists, code blocks, and Light/Dark mode.
- **Quick Search & Utilities:** Instant search (`Ctrl/Cmd + K`), note pinning, and 1-click copy.
- **Image Attachments:** Paste screenshots or upload images directly into a private `/assets` folder in Google Drive.
- **Client-Side Encryption:** Protect sensitive notes with **AES-256-GCM** encryption in the browser before syncing to Drive.

## Tech Stack

- **Framework:** Next.js (App Router) & TypeScript
- **Styling:** Tailwind CSS & Lucide Icons
- **Storage:** Google Drive API v3 (`.md` files with YAML frontmatter)
- **Security:** `otplib` (TOTP), `jose` (HttpOnly session cookies), Web Crypto API (AES-256-GCM)

## Environment Variables

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
DRIVE_ROOT_FOLDER_ID=
TOTP_SECRET=
MASTER_PIN=
JWT_SECRET=
```

## License

MIT