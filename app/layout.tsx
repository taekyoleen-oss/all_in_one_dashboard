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
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
