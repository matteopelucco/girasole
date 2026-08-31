'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { logout } from '@/app/actions';
import { vociMenuConStato } from '@/lib/navigazione';

function Logo() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 font-heading text-base font-semibold text-stone-900">
      <span aria-hidden className="text-lg">
        🌻
      </span>
      Girasole
    </Link>
  );
}

function ElencoVoci({ ruolo, pathname, onNavigazione }: { ruolo: string | null; pathname: string; onNavigazione?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {vociMenuConStato(ruolo, pathname).map((voce) => (
        <Link
          key={voce.href}
          href={voce.href}
          onClick={onNavigazione}
          aria-current={voce.attivo ? 'page' : undefined}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            voce.attivo
              ? 'bg-emerald-50 text-emerald-800'
              : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
          }`}
        >
          <span aria-hidden>{voce.icona}</span>
          {voce.etichetta}
        </Link>
      ))}
    </nav>
  );
}

// Shell dell'app per ogni pagina autenticata: sidebar fissa a sinistra da
// schermo lg in su (ispirata a TailAdmin, vedi specs/01 - ux.md), che
// sotto quella soglia si trasforma in un drawer aperto/chiuso da un
// pulsante hamburger — l'unico modo per far stare comodamente le voci di
// amministrazione, che in una singola riga orizzontale non ci stavano più
// a larghezza mobile. Riceve `children` (il `<main>` della pagina) invece
// di essere un semplice sibling, perché la sidebar a larghezza fissa deve
// "spingere" il contenuto con un padding-left solo da lg in su.
export function NavHeader({
  nome,
  ruolo,
  children,
}: {
  nome: string;
  ruolo: string | null;
  children: React.ReactNode;
}) {
  const [menuAperto, setMenuAperto] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-1">
      {menuAperto && (
        <button
          type="button"
          aria-label="Chiudi il menu"
          onClick={() => setMenuAperto(false)}
          className="fixed inset-0 z-20 bg-stone-900/40 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r-2 border-amber-400 bg-white transition-transform lg:translate-x-0 ${
          menuAperto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b border-stone-200 px-4 py-4">
          <Logo />
        </div>
        <ElencoVoci ruolo={ruolo} pathname={pathname} onNavigazione={() => setMenuAperto(false)} />
      </aside>

      <div className="flex flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-10 flex items-center border-b-2 border-amber-400 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3 lg:hidden">
            <button
              type="button"
              aria-label="Apri il menu"
              aria-expanded={menuAperto}
              onClick={() => setMenuAperto(true)}
              className="-ml-1 rounded-lg p-2 text-stone-600 hover:bg-stone-100"
            >
              <span aria-hidden className="text-lg">
                ☰
              </span>
            </button>
            <Logo />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-stone-600">{nome}</span>
            <form action={logout}>
              <PulsanteInvio mantieniTesto className="text-sm text-stone-600 hover:text-stone-900">
                Esci
              </PulsanteInvio>
            </form>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
