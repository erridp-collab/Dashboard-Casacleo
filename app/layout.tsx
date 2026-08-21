import type { Metadata, Viewport } from "next";
import { Fraunces, Public_Sans } from "next/font/google";
import "./globals.css";
import { TopBar } from "@/components/top-bar";
import { BottomNav } from "@/components/bottom-nav";
import { PageContainer } from "@/components/page-container";
import { ToastContainer } from "@/components/toast";
import { SwRegister } from "@/components/sw-register";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { NavigationFeedback } from "@/components/navigation-feedback";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#4A0E24",
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
      <body className={`${fraunces.variable} ${publicSans.variable} min-h-screen bg-canvas text-text-primary antialiased`}>
        <NavigationFeedback />
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
