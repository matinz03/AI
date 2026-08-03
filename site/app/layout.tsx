import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Matin Zomorrodabedi | Full Stack Developer',
  description:
    'Portfolio of Matin Zomorrodabedi, a full stack developer building thoughtful digital systems.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
