'use client';

import { useState } from 'react';

export type StatoGiornoOreLavoro = 'lavorativo' | 'malattia' | 'assenza';

export const ETICHETTE_STATO_ORE_LAVORO: Record<StatoGiornoOreLavoro, string> = {
  lavorativo: 'Lavorativo',
  malattia: 'Malattia',
  assenza: 'Assenza',
};

export type ValoriGiornoOreLavoro = {
  data: string;
  stato: StatoGiornoOreLavoro;
  oreOrdinarie: number | string;
  oreStraordinarie: number | string;
  motivoStraordinario: string;
  codiceMalattia: string;
  notaAssenza: string;
};

const CLASSE_INPUT =
  'mt-1 rounded-lg border border-stone-300 px-2 py-1 text-sm outline-none focus:border-stone-500';
const CLASSE_LABEL = 'flex flex-col text-xs text-stone-600';

// Riga editabile di un giorno nel form settimanale di "Ore di lavoro"
// (specs/18 - report-ore-lavoro.md): mostra solo i campi pertinenti allo
// stato scelto — ore ordinarie/straordinarie per "Lavorativo", codice
// per "Malattia", nota per "Assenza" — invece di tutti insieme, coerente
// con specs/01 - ux.md ("preferire azioni a un tap a form con molti
// campi da compilare"). Componente client solo per questo toggle
// visivo: la sottomissione resta un form nativo (ogni campo mantiene il
// proprio `name`, il genitore è un <form> con Server Action — nessun
// fetch qui, nessuno stato condiviso tra righe).
export function RigaOreLavoro({
  etichettaGiorno,
  dataBreve,
  valori,
  messaggioChiuso = null,
}: {
  etichettaGiorno: string;
  dataBreve: string;
  valori: ValoriGiornoOreLavoro;
  // Solo informativo (specs/18, specs/53): il giorno resta pienamente
  // modificabile anche quando l'asilo è chiuso, il personale può
  // comunque lavorare — null quando il giorno non è chiuso.
  messaggioChiuso?: string | null;
}) {
  const [stato, setStato] = useState<StatoGiornoOreLavoro>(valori.stato);
  const nomeCampo = (suffisso: string) => `${suffisso}_${valori.data}`;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">
          {etichettaGiorno} <span className="font-normal text-stone-600">{dataBreve}</span>
        </span>
        <select
          name={nomeCampo('stato')}
          value={stato}
          onChange={(e) => setStato(e.target.value as StatoGiornoOreLavoro)}
          aria-label={`Stato ${etichettaGiorno}`}
          className="rounded-lg border border-stone-300 px-2 py-1 text-sm outline-none focus:border-stone-500"
        >
          {Object.entries(ETICHETTE_STATO_ORE_LAVORO).map(([valore, etichetta]) => (
            <option key={valore} value={valore}>
              {etichetta}
            </option>
          ))}
        </select>
      </div>

      {messaggioChiuso && <p className="mt-1 text-xs text-stone-500">{messaggioChiuso}</p>}

      {stato === 'lavorativo' && (
        <div className="mt-2 flex flex-wrap gap-2">
          <label className={CLASSE_LABEL}>
            Ore ordinarie
            <input
              type="number"
              min={0}
              step={0.5}
              name={nomeCampo('ore_ordinarie')}
              defaultValue={valori.oreOrdinarie}
              aria-label={`Ore ordinarie ${etichettaGiorno}`}
              className={`${CLASSE_INPUT} w-20`}
            />
          </label>
          <label className={CLASSE_LABEL}>
            Ore straordinarie
            <input
              type="number"
              min={0}
              step={0.5}
              name={nomeCampo('ore_straordinarie')}
              defaultValue={valori.oreStraordinarie}
              aria-label={`Ore straordinarie ${etichettaGiorno}`}
              className={`${CLASSE_INPUT} w-20`}
            />
          </label>
          <label className={`${CLASSE_LABEL} min-w-[10rem] flex-1`}>
            Motivo straordinario
            <input
              type="text"
              name={nomeCampo('motivo_straordinario')}
              defaultValue={valori.motivoStraordinario}
              aria-label={`Motivo straordinario ${etichettaGiorno}`}
              className={CLASSE_INPUT}
            />
          </label>
        </div>
      )}

      {stato === 'malattia' && (
        <label className={`${CLASSE_LABEL} mt-2`}>
          Codice malattia
          <input
            type="text"
            name={nomeCampo('codice_malattia')}
            defaultValue={valori.codiceMalattia}
            aria-label={`Codice malattia ${etichettaGiorno}`}
            className={CLASSE_INPUT}
          />
        </label>
      )}

      {stato === 'assenza' && (
        <label className={`${CLASSE_LABEL} mt-2`}>
          Nota giustificativa
          <input
            type="text"
            name={nomeCampo('nota_assenza')}
            defaultValue={valori.notaAssenza}
            aria-label={`Nota assenza ${etichettaGiorno}`}
            className={CLASSE_INPUT}
          />
        </label>
      )}
    </div>
  );
}
