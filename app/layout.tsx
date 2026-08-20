import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Girasole — Asilo Sartorio',
  description: 'Gestione presenze, pasti e comunicazioni',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">{children}</body>
    </html>
  );
}
