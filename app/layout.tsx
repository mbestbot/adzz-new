import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthContext";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://adzz.pro"),
  title: {
    default: "Adzz",
    template: "%s · Adzz",
  },
  description: "The Ultimate Ad Engine for Discord",
  openGraph: {
    title: "Adzz",
    description: "The Ultimate Ad Engine for Discord",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        alt: "Adzz — The Ultimate Ad Engine for Discord",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Adzz",
    description: "The Ultimate Ad Engine for Discord",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  /** Discord / browsers use this for link-preview accent + PWA chrome tint */
  themeColor: "#7c3aed",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={plusJakarta.variable}>
      <body className={plusJakarta.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}