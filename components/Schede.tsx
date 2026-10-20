'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { ID_PANNELLO_SCHEDE, idTabScheda, indiceDaTasto, type Scheda } from '@/lib/schede';

// Barra delle schede di una pagina (pagina "Azioni", specs/63, issue #325;
// pagina "Calendario attività", specs/64, issue #328). Le schede sono link (la
// scheda attiva sta nell'indirizzo, la pagina si disegna sul server): il
// JavaScript serve solo per le frecce sinistra/destra, Home e Fine della
// tastiera, che spostano il focus e aprono la scheda (schema WAI-ARIA "tabs"
// con attivazione automatica). Il pannello (`role="tabpanel"`, id
// `ID_PANNELLO_SCHEDE`) lo disegna la pagina.
export function Schede({ schede, attiva }: { schede: readonly Scheda[]; attiva: string }) {
  const router = useRouter();
  const riferimenti = useRef<Array<HTMLAnchorElement | null>>([]);

  function suTasto(evento: React.KeyboardEvent<HTMLAnchorElement>, indice: number) {
    const prossimo = indiceDaTasto(evento.key, indice, schede.length);
    if (prossimo === null) return;
    evento.preventDefault();
    riferimenti.current[prossimo]?.focus();
    router.push(schede[prossimo].href, { scroll: false });
  }

  return (
    <div role="tablist" aria-label="Schede della pagina" className="flex border-b border-border">
      {schede.map((scheda, indice) => {
        const selezionata = scheda.id === attiva;
        return (
          <Link
            key={scheda.id}
            ref={(el) => {
              riferimenti.current[indice] = el;
            }}
            id={idTabScheda(scheda.id)}
            role="tab"
            href={scheda.href}
            scroll={false}
            aria-selected={selezionata}
            aria-controls={selezionata ? ID_PANNELLO_SCHEDE : undefined}
            tabIndex={selezionata ? 0 : -1}
            onKeyDown={(evento) => suTasto(evento, indice)}
            className={`-mb-px inline-flex min-h-11 flex-1 items-center justify-center border-b-2 px-4 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-stone-900 sm:flex-none ${
              selezionata
                ? 'border-stone-900 font-semibold text-stone-900'
                : 'border-transparent text-stone-600 hover:border-stone-300 hover:text-stone-900'
            }`}
          >
            {scheda.etichetta}
          </Link>
        );
      })}
    </div>
  );
}
