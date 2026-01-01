import "./globals.css";
import { RootProvider } from "fumadocs-ui/provider";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import localFont from "next/font/local";

const jetBrainsMono = localFont({
  src: [
    {
      path: "../public/fonts/JetBrainsMonoNerdFont-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/JetBrainsMonoNerdFont-Italic.ttf",
      weight: "400",
      style: "italic",
    },
    {
      path: "../public/fonts/JetBrainsMonoNerdFont-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/JetBrainsMonoNerdFont-MediumItalic.ttf",
      weight: "500",
      style: "italic",
    },
    {
      path: "../public/fonts/JetBrainsMonoNerdFont-SemiBold.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../public/fonts/JetBrainsMonoNerdFont-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "../public/fonts/JetBrainsMonoNerdFont-BoldItalic.ttf",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s | valrs",
    default: "valrs - High-performance schema validation",
  },
  description:
    "High-performance schema validation powered by Rust and WebAssembly. Implements the Standard Schema specification.",
  openGraph: {
    title: "valrs",
    description: "High-performance schema validation powered by Rust and WebAssembly",
    siteName: "valrs",
  },
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={jetBrainsMono.variable} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col font-mono">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
