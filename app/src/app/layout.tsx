import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@context/Provider";
import { ToastProvider } from "@components/providers/ToastProvider";
import { ProjectMetaProvider } from "@components/providers/ProjectMetaProvider";
import { SecurityProvider } from "@context/SecurityContext";

// Configure fonts for Turbopack compatibility
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: "Full Stack - Application",
  description: "Modern full-stack application with authentication and dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div id="project-body-meta" />
        <SecurityProvider>
          <Providers>
            <ProjectMetaProvider>
              {children}
            </ProjectMetaProvider>
          </Providers>
        </SecurityProvider>
      </body>
    </html>
  );
}
