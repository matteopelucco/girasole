import './globals.css';
import type { Metadata } from 'next';
import { VERSIONE_APP, DATA_BUILD } from '@/lib/versione';

export const metadata: Metadata = {
  title: 'Girasole — Asilo Sartorio',
  description: 'Gestione presenze, pasti e comunicazioni',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <div className="flex min-h-screen flex-col">
          <div className="flex flex-1 flex-col">{children}</div>
          <footer className="py-3 text-center text-xs text-stone-600">
            Girasole v{VERSIONE_APP} — build {DATA_BUILD}
          </footer>
        </div>
      </body>
    </html>
  );
}
