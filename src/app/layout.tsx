import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NoDistanceNote",
  description: "Personal notes synced to Google Drive, secured with a Dynamic Security Key",
  robots: { index: false, follow: false },
};

const themeScript = `try{var t=localStorage.getItem('ndn-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
