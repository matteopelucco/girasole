'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Finestra } from './ui/finestra';
import { Pulsante } from './ui/pulsante';

// "Gestisci" di un mese comunicato in "Pagamenti bambino" (specs/60, PAG-26;
// issue #435): un pulsante sulla riga che apre una finestra con tutte le
// azioni del mese. Il contenuto (riepilogo e sezioni) lo costruisce la pagina,
// che è un Server Component, e arriva come `children`: qui c'è solo il
// guscio. La finestra è montata solo quando è aperta, così ogni apertura
// riparte dai dati registrati; dopo un'azione la pagina si aggiorna e la
// finestra, che resta aperta, mostra i dati nuovi.
//
// Se l'indirizzo punta alla riga di questo mese (`#mese-AAAA-MM`, il link
// "Verifica" di "Rette", PAG-18), la finestra si apre da sola al caricamento,
// con il focus prima portato su "Gestisci", dove torna alla chiusura.
export function GestionePagamento({
  mese,
  meseEtichetta,
  bambinoNome,
  children,
}: {
  // "AAAA-MM".
  mese: string;
  // Es. "settembre 2026".
  meseEtichetta: string;
  bambinoNome: string;
  children: ReactNode;
}) {
  const [aperta, setAperta] = useState(false);
  const pulsanteRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // L'indirizzo si legge solo nel browser, dopo l'idratazione: aprire nel
    // primo render darebbe un HTML diverso da quello del server.
    if (window.location.hash !== `#mese-${mese}`) return;
    pulsanteRef.current?.focus();
    setAperta(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, [mese]);

  return (
    <>
      <Pulsante
        ref={pulsanteRef}
        variante="secondario"
        misura="piccolo"
        aria-label={`Gestisci ${meseEtichetta}`}
        aria-haspopup="dialog"
        onClick={() => setAperta(true)}
      >
        Gestisci
      </Pulsante>
      {aperta && (
        <Finestra
          titolo={`Pagamento di ${bambinoNome}, ${meseEtichetta}`}
          larghezza="lg"
          onChiudi={() => setAperta(false)}
        >
          <div className="mt-3 space-y-4 text-sm">{children}</div>
          <div className="mt-5 flex justify-end">
            <Pulsante variante="secondario" misura="normale" onClick={() => setAperta(false)}>
              Chiudi
            </Pulsante>
          </div>
        </Finestra>
      )}
    </>
  );
}
