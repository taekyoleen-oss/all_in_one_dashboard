import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PaneBoard",
  description: "개인 모듈형 캔버스 대시보드",
  applicationName: "PaneBoard",
  // Icons + manifest are wired automatically via app/icon.svg, app/apple-icon.tsx
  // and app/manifest.ts (file conventions). appleWebApp makes the iOS home-screen
  // launch open standalone (no Safari chrome) with the app name.
  appleWebApp: {
    capable: true,
    title: "PaneBoard",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Dark is the default theme. data-theme="dark" matches the token base on
    // :root; switch to "light" to opt into the light override. data-updown
    // selects 등락 color convention (kr default = 상승 red / 하락 blue).
    <html
      lang="ko"
      data-theme="dark"
      data-updown="kr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        {/* Restore the persisted theme (dark/light) BEFORE paint so there's no
            flash. Reads the same key as lib/utils/theme.ts (usePersistedTheme). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('pb:theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();",
          }}
        />
        {/* Self-heal: PaneBoard does NOT use a service worker. If a stale SW from a
            prior app on this origin is still controlling localhost it can serve
            outdated chunks (e.g. a removed icon import → "module factory not
            available"). Unregister any SW + clear caches, then reload ONCE (guarded)
            so fresh chunks load. No-op when there's no SW. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if('serviceWorker'in navigator){navigator.serviceWorker.getRegistrations().then(function(rs){if(!rs||!rs.length)return;Promise.all(rs.map(function(r){return r.unregister();})).then(function(){if(window.caches&&caches.keys){caches.keys().then(function(ks){ks.forEach(function(k){caches.delete(k);});});}if(!sessionStorage.getItem('pb-sw-cleaned')){sessionStorage.setItem('pb-sw-cleaned','1');location.reload();}});}).catch(function(){});}}catch(e){}})();",
          }}
        />
        {children}
      </body>
    </html>
  );
}
