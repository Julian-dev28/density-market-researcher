import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Macro + Crypto Research Dashboard",
  description: "Live macro and crypto signals powered by Claude Opus 4.6",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0a0a0a] text-white min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
