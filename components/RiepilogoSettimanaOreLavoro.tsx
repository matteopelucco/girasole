'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { riepilogoSettimanaDaDifferenze } from '@/lib/monteOre';
import { formattaOreConSegno } from '@/lib/oreLavoro';

// Valori di un giorno come mostrati nella sua card (specs/18): anche le
// modifiche non ancora salvate. `differenza` è null se il testo digitato
// non è un numero valido.
export type GiornoRiepilogoLive = { stato: string; orePreviste: number; differenza: number | null };

type Contesto = {
  giorni: Record<string, GiornoRiepilogoLive>;
  aggiorna: (data: string, valori: GiornoRiepilogoLive) => void;
};

const ContestoRiepilogo = createContext<Contesto | null>(null);

// Tiene i valori delle card dei 7 giorni, così il riepilogo della
// settimana si aggiorna subito a ogni modifica, senza attendere il
// salvataggio (specs/18, scenario "il riepilogo si aggiorna con quanto
// digitato"). Il form resta nativo: questo stato serve solo al riepilogo.
export function SettimanaOreLavoroProvider({
  iniziale,
  children,
}: {
  iniziale: Record<string, GiornoRiepilogoLive>;
  children: ReactNode;
}) {
  const [giorni, setGiorni] = useState(iniziale);
  const aggiorna = useCallback((data: string, valori: GiornoRiepilogoLive) => {
    setGiorni((corrente) => {
      const precedente = corrente[data];
      if (
        precedente &&
        precedente.stato === valori.stato &&
        precedente.orePreviste === valori.orePreviste &&
        precedente.differenza === valori.differenza
      ) {
        return corrente;
      }
      return { ...corrente, [data]: valori };
    });
  }, []);
  const valore = useMemo(() => ({ giorni, aggiorna }), [giorni, aggiorna]);
  return <ContestoRiepilogo.Provider value={valore}>{children}</ContestoRiepilogo.Provider>;
}

// Per le card: comunica al riepilogo i valori correnti di un giorno.
// Fuori dal provider (vista di sola lettura) non fa nulla.
export function useAggiornaGiornoRiepilogo() {
  return useContext(ContestoRiepilogo)?.aggiorna ?? null;
}

// Riquadro riassuntivo della settimana (specs/18, specs/19): "Ore
// previste" e "Differenza ore" (erogate − previste, con segno): un calcolo
// informativo, il monte ore è gestito a mano dall'admin. Legge sempre le
// card dei giorni (anche non salvate), per ogni settimana — anche
// confermata e corretta dall'admin, così non diverge mai da quanto
// mostrato sopra (#151). Va dentro `SettimanaOreLavoroProvider`.
export function RiepilogoSettimanaOreLavoro() {
  const contesto = useContext(ContestoRiepilogo);
  const riepilogo = riepilogoSettimanaDaDifferenze(Object.values(contesto?.giorni ?? {}));

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3 text-sm text-stone-600 shadow-sm">
      <p>
        Ore previste: <strong>{riepilogo.orePreviste}h</strong>
      </p>
      <p>
        Differenza ore: <strong>{formattaOreConSegno(riepilogo.differenza)}h</strong>
      </p>
    </div>
  );
}
