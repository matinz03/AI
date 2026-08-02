import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flowboard",
  description: "A focused project board for teams that like to move.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
