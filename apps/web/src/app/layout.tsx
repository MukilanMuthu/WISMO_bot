import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WISMO Operations",
  description: "Retell-powered order tracking voice assistant prototype",
};

// Provide one stable document shell for customer and operations views.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
