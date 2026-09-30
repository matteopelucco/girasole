'use client';

import { useEffect, useState } from 'react';
import {
  ETICHETTE_STATO_ORE_LAVORO,
  isStatoNeutroOreLavoro,
  TESTO_GIORNO_DI_VACANZA,
  sonoQuartiDora,
  totaleOreErogate,
  type StatoGiornoOreLavoro,
} from '@/lib/oreLavoro';
import { classeCardOreLavoro, OrePreviste, TotaleOreErogate } from '@/components/CardOreLavoroParti';
import { useAggiornaGiornoRiepilogo } from '@/components/RiepilogoSettimanaOreLavoro';

export type ValoriGiornoOreLavoro = {
  data: string;
  stato: StatoGiornoOreLavoro;
  // Ore in più (+) o in meno (-) rispetto al previsto, già calcolate
  // dalla pagina (differenzaGiornoOreLavoro) dai dati salvati.
  differenzaOre: number;
  motivo: string;
  codiceMalattia: string;
  notaAssenza: string;
};

const CLASSE_INPUT =
  'mt-1 rounded-lg border border-stone-300 px-2 py-1 text-sm outline-none focus:border-stone-500';
const CLASSE_LABEL = 'flex flex-col text-xs text-stone-600';
// Bersagli tattili di almeno 44px (specs/01 - ux.md, uso da telefono).
const CLASSE_INPUT_TATTILE = 'mt-1 h-11 rounded-lg border border-stone-300 px-2 text-base outline-none focus:border-stone-500';
const CLASSE_PULSANTE_PASSO =
  'mt-1 h-11 w-11 shrink-0 rounded-lg border border-stone-300 bg-white text-xl font-medium text-stone-700 hover:bg-stone-100';

const PASSO_ORE = 0.25;

function arrotonda(valore: number): number {
  return Math.round(valore * 100) / 100;
}

// Riga editabile di un giorno nel form settimanale di "Ore di lavoro"
// (specs/18 - report-ore-lavoro.md): per "Lavorativo" mostra le ore
// ordinarie (non modificabili, quelle previste dal profilo orario), la
// "Differenza ore" (l'unico campo modificabile, +/- multipli di un
// quarto d'ora), il motivo (solo se la differenza è diversa da 0) e il
// totale erogato calcolato; la card è verde con differenza 0, rossa
// altrimenti, sempre con un testo oltre al colore (specs/01). Per
// "Malattia" il codice, per "Assenza" la nota. Componente client solo
// per lo stato di questi campi: la sottomissione resta un form nativo
// (ogni campo mantiene il proprio `name`, il genitore è un <form> con
// Server Action — nessun fetch qui, nessuno stato condiviso tra righe).
// La validazione vera è lato server (validaGiornoOreLavoro).
export function RigaOreLavoro({
  etichettaGiorno,
  dataBreve,
  valori,
  messaggioChiuso = null,
  orePreviste = null,
}: {
  etichettaGiorno: string;
  dataBreve: string;
  valori: ValoriGiornoOreLavoro;
  // Solo informativo (specs/18, specs/53): il giorno resta pienamente
  // modificabile anche quando l'asilo è chiuso, il personale può
  // comunque lavorare — null quando il giorno non è chiuso.
  messaggioChiuso?: string | null;
  // Ore previste dal profilo orario per questo giorno (specs/18, specs/54):
  // sono le "Ore ordinarie" mostrate (non modificabili) e il riferimento
  // statico "Previsto: Xh" — null se non c'è un profilo assegnato (in
  // quel caso le ore ordinarie sono 0).
  orePreviste?: number | null;
}) {
  const [stato, setStato] = useState<StatoGiornoOreLavoro>(valori.stato);
  const [differenzaTesto, setDifferenzaTesto] = useState(String(valori.differenzaOre));
  const [motivo, setMotivo] = useState(valori.motivo);
  const nomeCampo = (suffisso: string) => `${suffisso}_${valori.data}`;

  const ordinarie = orePreviste ?? 0;
  const testoNormalizzato = differenzaTesto.trim().replace(',', '.');
  const differenza = testoNormalizzato === '' ? 0 : Number(testoNormalizzato);
  const differenzaValida = Number.isFinite(differenza);
  const totale = differenzaValida ? totaleOreErogate(ordinarie, differenza) : null;
  const inRegola = differenzaValida && differenza === 0;
  const fuoriRegola = differenzaValida && differenza !== 0;
  const problema = !differenzaValida
    ? 'Scrivi un numero (es. 1, 2.5, -0.5).'
    : !sonoQuartiDora(differenza)
      ? "Le ore devono essere multipli di un quarto d'ora (es. 1, 2.5, 0.25)."
      : totale !== null && totale < 0
        ? `La differenza non può superare le ore ordinarie (${ordinarie}h): il totale non può essere negativo.`
        : null;

  // Comunica al riepilogo della settimana i valori correnti della card,
  // anche non salvati (specs/18).
  const aggiornaRiepilogo = useAggiornaGiornoRiepilogo();
  const dataGiorno = valori.data;
  const differenzaPerRiepilogo = differenzaValida ? differenza : null;
  useEffect(() => {
    aggiornaRiepilogo?.(dataGiorno, { stato, orePreviste: ordinarie, differenza: differenzaPerRiepilogo });
  }, [aggiornaRiepilogo, dataGiorno, stato, ordinarie, differenzaPerRiepilogo]);

  const cambiaDifferenza = (passo: number) => {
    const base = differenzaValida ? differenza : 0;
    setDifferenzaTesto(String(arrotonda(base + passo)));
  };

  const classeCard = stato !== 'lavorativo' ? classeCardOreLavoro(null) : classeCardOreLavoro(differenzaValida ? differenza : null);

  return (
    <div className={`rounded-xl border p-3 shadow-sm ${classeCard}`}>
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

      {messaggioChiuso && <p className="mt-1 text-xs text-stone-700">{messaggioChiuso}</p>}

      {stato === 'lavorativo' && (
        <div className="mt-2 space-y-3">
          <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
            {/* Ore ordinarie: solo testo, non modificabili (specs/18). */}
            <OrePreviste orePreviste={orePreviste} />

            <div className={CLASSE_LABEL}>
              <label htmlFor={`differenza-${valori.data}`}>Differenza ore (in più + / in meno −)</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => cambiaDifferenza(-PASSO_ORE)}
                  aria-label={`Un quarto d'ora in meno ${etichettaGiorno}`}
                  className={CLASSE_PULSANTE_PASSO}
                >
                  −
                </button>
                <input
                  id={`differenza-${valori.data}`}
                  type="number"
                  step={PASSO_ORE}
                  name={nomeCampo('differenza_ore')}
                  value={differenzaTesto}
                  onChange={(e) => setDifferenzaTesto(e.target.value)}
                  aria-label={`Differenza ore ${etichettaGiorno}`}
                  aria-invalid={problema ? true : undefined}
                  className={`${CLASSE_INPUT_TATTILE} w-24 text-center`}
                />
                <button
                  type="button"
                  onClick={() => cambiaDifferenza(PASSO_ORE)}
                  aria-label={`Un quarto d'ora in più ${etichettaGiorno}`}
                  className={CLASSE_PULSANTE_PASSO}
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {problema && (
            <p className="text-xs font-medium text-red-800">{problema}</p>
          )}

          {fuoriRegola && (
            <label className={`${CLASSE_LABEL} max-w-md`}>
              Motivo (obbligatorio)
              <input
                type="text"
                name={nomeCampo('motivo')}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                aria-label={`Motivo ${etichettaGiorno}`}
                placeholder="Perché hai fatto più o meno ore?"
                className={CLASSE_INPUT_TATTILE}
              />
            </label>
          )}

          <TotaleOreErogate etichettaGiorno={etichettaGiorno} totale={totale} differenza={differenzaValida ? differenza : null} />
        </div>
      )}

      {isStatoNeutroOreLavoro(stato) && <p className="mt-2 text-sm text-stone-700">{TESTO_GIORNO_DI_VACANZA}</p>}

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
