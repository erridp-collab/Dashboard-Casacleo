import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TopBar } from "@/components/top-bar";
import { BottomNav } from "@/components/bottom-nav";
import { PageContainer } from "@/components/page-container";
import { ToastContainer } from "@/components/toast";
import { SwRegister } from "@/components/sw-register";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#701a2f",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Alva Host Manager",
  description: "Operational manager for bookings, actions, stock, and finance",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Alva Host",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-background text-foreground antialiased`}>
        <SwRegister />
        <PwaInstallPrompt />
        <div className="min-h-screen">
          <TopBar />
          <PageContainer>{children}</PageContainer>
          <BottomNav />
          <ToastContainer />
        </div>
      </body>
    </html>
  );
}
