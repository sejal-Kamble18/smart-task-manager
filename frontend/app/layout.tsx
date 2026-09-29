import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";

// Shared document metadata and global styles for all routes.

export const metadata: Metadata = {
  title: "Smart Tasks",
  description: "A focused task manager with real dependency blocking.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 font-sans text-slate-900">
        <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading...</div>}>
          {children}
        </Suspense>
      </body>
    </html>
  );
}
