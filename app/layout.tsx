import type { Metadata, Viewport } from "next";
import "../src/styles/index.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://nashuha-shafiq.vercel.app"),
  title: "Nashuha & Shafiq - Jemputan Perkahwinan | 22 Ogos 2026",
  description:
    "Anda dijemput ke Majlis Perkahwinan Fatin Nashuha dan Mohamad Shafiq pada 22 Ogos 2026 di Kulim Golf Resort & Country, Kedah.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Nashuha & Shafiq - Jemputan Perkahwinan",
    description: "Sabtu, 22 Ogos 2026 - Kulim Golf Resort & Country, Kedah.",
    type: "website",
    images: [{ url: "/Main Page.png" }],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4a0c21",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ms">
      <body>{children}</body>
    </html>
  );
}
