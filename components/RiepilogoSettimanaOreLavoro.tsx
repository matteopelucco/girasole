'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  descrizioneEffettoMonteOre,
  riepilogoSettimanaDaDifferenze,
  type RiepilogoSettimanaOreLavoro,
} from '@/lib/monteOre';
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
// previste" e "Differenza ore" (erogate − previste, con segno), più
// l'effetto sul monte ore. Con `live` legge le card (anche non salvate),
// altrimenti mostra `riepilogoFisso` (snapshot di una settimana confermata).
export function RiepilogoSettimanaOreLavoro({
  live,
  riepilogoFisso,
  mostraEffettoMonteOre,
}: {
  live: boolean;
  riepilogoFisso: RiepilogoSettimanaOreLavoro;
  mostraEffettoMonteOre: boolean;
}) {
  const contesto = useContext(ContestoRiepilogo);
  const riepilogo =
    live && contesto ? riepilogoSettimanaDaDifferenze(Object.values(contesto.giorni)) : riepilogoFisso;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3 text-sm text-stone-600 shadow-sm">
      <p>
        Ore previste: <strong>{riepilogo.orePreviste}h</strong>
      </p>
      <p>
        Differenza ore: <strong>{formattaOreConSegno(riepilogo.differenza)}h</strong>
      </p>
      {mostraEffettoMonteOre && (
        <p className="mt-2 border-t border-stone-100 pt-2 text-purple-800">
          A settimana confermata: <strong>{descrizioneEffettoMonteOre(riepilogo.variazioneMonteOre)}</strong>
        </p>
      )}
    </div>
  );
}
