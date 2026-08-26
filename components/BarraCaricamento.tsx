'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// Barra di caricamento in cima alla pagina, riscontro visivo immediato
// durante la navigazione tra pagine (specs/01 - ux.md): un'app a Server
// Components come questa impiega un giro di rete ad ogni cambio pagina,
// altrimenti percepito come "qualche secondo" di attesa silenziosa.
// Pattern standard del web (YouTube, GitHub, ...), nessuna dipendenza
// nuova: un click su un link avvia l'animazione, il cambio di
// pathname/query (segno che la nuova pagina è arrivata) la interrompe.
// Diversa e complementare al feedback di PulsanteInvio (specs/05 -
// feedback.md), che riguarda invece l'invio di un form/Server Action,
// non la navigazione tra pagine.
export function BarraCaricamento() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [inCorso, setInCorso] = useState(false);
  const percorsoAttuale = useRef(`${pathname}?${searchParams.toString()}`);

  useEffect(() => {
    function gestisciClick(evento: MouseEvent) {
      if (evento.defaultPrevented || evento.button !== 0) return;
      if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;

      const link = (evento.target as HTMLElement | null)?.closest('a');
      if (!link) return;
      if (link.target && link.target !== '_self') return;
      if (link.hasAttribute('download')) return;

      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

      let destinazione: URL;
      try {
        destinazione = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (destinazione.origin !== window.location.origin) return;
      if (`${destinazione.pathname}${destinazione.search}` === percorsoAttuale.current) return;

      setInCorso(true);
    }

    document.addEventListener('click', gestisciClick);
    return () => document.removeEventListener('click', gestisciClick);
  }, []);

  useEffect(() => {
    percorsoAttuale.current = `${pathname}?${searchParams.toString()}`;
    setInCorso(false);
  }, [pathname, searchParams]);

  if (!inCorso) return null;

  return (
    <div
      role="status"
      aria-label="Caricamento in corso"
      className="fixed left-0 right-0 top-0 z-50 h-1 overflow-hidden bg-emerald-100"
    >
      <div className="h-full w-1/3 animate-[barra-caricamento_1.1s_ease-in-out_infinite] bg-emerald-600" />
    </div>
  );
}
