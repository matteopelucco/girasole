import './globals.css';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Poppins, Open_Sans } from 'next/font/google';
import { BarraCaricamento } from '@/components/BarraCaricamento';
import { VERSIONE_APP, DATA_BUILD } from '@/lib/versione';

// Coppia di font ispirata al riferimento grafico Falcon (Poppins per i
// titoli, Open Sans per il testo): next/font ottimizza il caricamento
// (self-hosting automatico, nessuna richiesta a Google in runtime) e fa
// già parte di Next.js, nessuna dipendenza nuova.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

const openSans = Open_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-open-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Girasole — Asilo Sartorio',
  description: 'Gestione presenze, pasti e comunicazioni',
  appleWebApp: {
    title: 'Girasole',
    statusBarStyle: 'default',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${poppins.variable} ${openSans.variable}`}>
      <body className="min-h-screen bg-slate-100 text-stone-900 antialiased">
        <Suspense fallback={null}>
          <BarraCaricamento />
        </Suspense>
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
