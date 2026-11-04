'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

// Gettone animato del pre/post-asilo da addebitare (specs/13, GET-02, GET-05,
// GET-06, GET-14). Solo CSS (`.gettone` in app/globals.css), decorativo
// (aria-hidden): il significato sta nella scritta accanto, mai nel gettone.
//
// Quando si anima: solo se il gettone compare DOPO che la pagina è pronta,
// cioè in seguito a un'azione dell'utente (la schermata si aggiorna e il
// gettone nasce). Se c'è già al caricamento o al ricaricamento della pagina
// resta fermo (`data-animato="false"`). Non si salva nulla: lo stabilisce il
// momento in cui il gettone viene creato nel browser. Un gettone già
// presente non riparte quando la schermata si aggiorna per altri motivi.
const PaginaPronta = createContext<RefObject<boolean> | null>(null);

export function ProveGettoni({ children }: { children: ReactNode }) {
  const pronta = useRef(false);
  useEffect(() => {
    // Rinviato di un giro: i gettoni presenti al caricamento (e il doppio
    // avvio in sviluppo) vedono ancora "non pronta" e restano fermi.
    const t = setTimeout(() => {
      pronta.current = true;
    }, 0);
    return () => clearTimeout(t);
  }, []);
  return <PaginaPronta.Provider value={pronta}>{children}</PaginaPronta.Provider>;
}

export function Gettone({ testid }: { testid: string }) {
  const pronta = useContext(PaginaPronta);
  const [animato, setAnimato] = useState(false);

  useEffect(() => {
    if (pronta?.current) setAnimato(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, [pronta]);

  return (
    <span
      aria-hidden="true"
      data-testid={testid}
      data-animato={animato ? 'true' : 'false'}
      className="gettone"
      onAnimationEnd={() => setAnimato(false)}
    />
  );
}
