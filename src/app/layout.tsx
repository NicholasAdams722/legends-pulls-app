import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Legends Pulls",
  description: "Inventory transfers between Legends stores",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pulls",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-zinc-950 text-zinc-100 flex flex-col">
        {children}
      </body>
    </html>
  );
}
