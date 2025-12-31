import "./globals.css";
import { RootProvider } from "fumadocs-ui/provider";
import type { ReactNode } from "react";
import type { Metadata } from "next";

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
    <html lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
