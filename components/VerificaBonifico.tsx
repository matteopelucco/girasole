'use client';

import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';
import { ESITO_INIZIALE, type EsitoAzione } from './FormConEsito';
import { formattaImporto } from '@/lib/comunicazioneRetta';
import { formattaDataOraItaliana } from '@/lib/date';

// Verifica del bonifico di una comunicazione già inviata (specs/59 -
// verifica-bonifico-retta.md): due azioni ("Bonifico corretto"/
// "Importo diverso") finché è "da verificare"; una volta marcato, uno
// stato di sola lettura con un pulsante "Annulla verifica" per tornare
// "da verificare" (per correggere un click sbagliato) — se lo stato
// annullato era "importo diverso", un avviso persistente invita
// l'admin a ricontrollare i crediti/debiti del bambino (l'annullo non
// li tocca automaticamente, specs/59), con un link di cortesia alla
// sua scheda.
//
// NON usa FormConEsito/<form> (a differenza della prima versione):
// nella vista del mese corrente, ogni riga di RigaComunicazione vive
// già dentro il <form> "Invia comunicazioni" che avvolge l'intera
// tabella (app/admin/rette/page.tsx) — un secondo <form> annidato qui
// dentro è HTML non valido e il browser lo gestisce spaginando/
// riposizionando il contenuto in modo imprevedibile (bug osservato in
// produzione). Le azioni vengono quindi invocate direttamente come
// funzioni async (una Server Action è chiamabile così, non solo
// tramite useFormState) dentro un useTransition, con pending/esito
// gestiti a mano — stesso genere di problema, e stessa soluzione di
// "niente form annidati", già presente per "Annulla invio"/"Invia
// comunicazione singola" in questa pagina, solo che lì basta un
// formAction bindato su un bottone perché non servono altri campi;
// "Importo diverso" ne ha tre, quindi niente <form>, solo ref letti al
// click di "Conferma".
export function VerificaBonifico({
  bambinoId,
  bambinoNome,
  totale,
  stato,
  importoRicevuto,
  nota,
  verificatoDaNome,
  verificatoIl,
  meseSuggerito,
  meseMinimo,
  marcaCorretto,
  marcaImportoErrato,
  resettaVerifica,
}: {
  // comunicazioneId non è tra le prop: `marcaCorretto`/
  // `marcaImportoErrato`/`resettaVerifica` arrivano già "bindate" a
  // quell'id dal chiamante (app/admin/rette/page.tsx) — coerente con
  // lo stesso pattern già usato per "Annulla invio"/"Invia
  // comunicazione". `bambinoId` invece serve qui per il link di
  // cortesia alla scheda del bambino dopo un annullo di "importo
  // diverso".
  bambinoId: string;
  bambinoNome: string;
  totale: number;
  stato: 'in_attesa' | 'corretto' | 'importo_errato';
  importoRicevuto: number | null;
  nota: string | null;
  verificatoDaNome: string | null;
  verificatoIl: string | null;
  meseSuggerito: string;
  meseMinimo: string;
  marcaCorretto: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
  marcaImportoErrato: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
  resettaVerifica: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
}) {
  const [apertoModale, setApertoModale] = useState(false);
  const [esitoCorretto, setEsitoCorretto] = useState<EsitoAzione>(ESITO_INIZIALE);
  const [esitoModale, setEsitoModale] = useState<EsitoAzione>(ESITO_INIZIALE);
  const [esitoReset, setEsitoReset] = useState<EsitoAzione>(ESITO_INIZIALE);
  const [avvisaControlloConguagli, setAvvisaControlloConguagli] = useState(false);
  const [pendingCorretto, avviaCorretto] = useTransition();
  const [pendingModale, avviaModale] = useTransition();
  const [pendingReset, avviaReset] = useTransition();
  const importoRef = useRef<HTMLInputElement>(null);
  const notaRef = useRef<HTMLInputElement>(null);
  const meseRef = useRef<HTMLInputElement>(null);

  function confermaReset(statoAttuale: 'corretto' | 'importo_errato') {
    const messaggioConferma =
      statoAttuale === 'importo_errato'
        ? `Annullare la verifica del bonifico di ${bambinoNome}? Tornerà "da verificare" — ricordati di ricontrollare i crediti/debiti eventualmente generati sulla sua scheda.`
        : `Annullare la verifica del bonifico di ${bambinoNome}? Tornerà "da verificare".`;
    if (!window.confirm(messaggioConferma)) return;

    avviaReset(async () => {
      const risultato = await resettaVerifica(ESITO_INIZIALE, new FormData());
      setEsitoReset(risultato);
      if (risultato.ok && statoAttuale === 'importo_errato') {
        setAvvisaControlloConguagli(true);
      }
    });
  }

  if (stato === 'corretto' || stato === 'importo_errato') {
    return (
      <div className="mt-1">
        {stato === 'corretto' ? (
          <p className="text-xs text-emerald-700">
            Bonifico ricevuto (importo corretto) — verificato da {verificatoDaNome} il{' '}
            {verificatoIl ? formattaDataOraItaliana(verificatoIl) : ''}
          </p>
        ) : (
          <p className="text-xs text-amber-700">
            Bonifico ricevuto (importo diverso): {formattaImporto(importoRicevuto ?? 0)} invece di{' '}
            {formattaImporto(totale)} — {nota} — verificato da {verificatoDaNome} il{' '}
            {verificatoIl ? formattaDataOraItaliana(verificatoIl) : ''}
          </p>
        )}
        <button
          type="button"
          disabled={pendingReset}
          aria-busy={pendingReset}
          onClick={() => confermaReset(stato)}
          className="mt-1 rounded-lg border border-stone-300 px-2 py-0.5 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Annulla verifica
        </button>
        {!esitoReset.ok && (
          <div role="alert" className="mt-1 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
            <p className="font-medium">{esitoReset.messaggio}</p>
            {esitoReset.dettaglio && <p className="mt-1 text-xs text-red-600">{esitoReset.dettaglio}</p>}
          </div>
        )}
      </div>
    );
  }

  function confermaBonificoCorretto() {
    if (
      !window.confirm(
        `Confermi che il bonifico di ${bambinoNome} è stato ricevuto per l'importo corretto (${formattaImporto(totale)})?`
      )
    ) {
      return;
    }
    avviaCorretto(async () => {
      setEsitoCorretto(await marcaCorretto(ESITO_INIZIALE, new FormData()));
    });
  }

  // Stessa validazione "campo obbligatorio" che un <input required>
  // darebbe nativamente dentro un <form> — qui va fatta a mano, perché
  // senza <form> l'attributo required non ha alcun effetto.
  function confermaImportoErrato() {
    const importoValore = importoRef.current?.value ?? '';
    const notaValore = (notaRef.current?.value ?? '').trim();
    if (!importoValore) {
      setEsitoModale({ ok: false, messaggio: "Inserisci l'importo realmente ricevuto." });
      return;
    }
    if (!notaValore) {
      setEsitoModale({ ok: false, messaggio: 'Scrivi una nota che spieghi la differenza.' });
      return;
    }

    const dati = new FormData();
    dati.set('importo_ricevuto', importoValore);
    dati.set('nota', notaValore);
    dati.set('mese_competenza', meseRef.current?.value ?? '');
    avviaModale(async () => {
      const risultato = await marcaImportoErrato(ESITO_INIZIALE, dati);
      setEsitoModale(risultato);
      if (risultato.ok) setApertoModale(false);
    });
  }

  return (
    <>
      {avvisaControlloConguagli && (
        <p className="mt-1 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          Hai annullato una verifica &quot;importo diverso&quot;: ricontrolla i crediti/debiti di {bambinoNome}, non
          sono stati toccati automaticamente —{' '}
          <Link href={`/admin/bambini/${bambinoId}`} className="underline">
            vai alla scheda
          </Link>
        </p>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-stone-500">Bonifico da verificare</span>
        <button
          type="button"
          disabled={pendingCorretto}
          aria-busy={pendingCorretto}
          onClick={confermaBonificoCorretto}
          className="rounded-lg border border-emerald-300 px-2 py-0.5 font-medium text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Bonifico corretto
        </button>
        <button
          type="button"
          onClick={() => {
            setEsitoModale(ESITO_INIZIALE);
            setApertoModale(true);
          }}
          className="rounded-lg border border-amber-300 px-2 py-0.5 font-medium text-amber-700 hover:bg-amber-50"
        >
          Importo diverso
        </button>
      </div>
      {!esitoCorretto.ok && (
        <div role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
          <p className="font-medium">{esitoCorretto.messaggio}</p>
          {esitoCorretto.dettaglio && <p className="mt-1 text-xs text-red-600">{esitoCorretto.dettaglio}</p>}
        </div>
      )}

      {apertoModale && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Importo bonifico diverso per ${bambinoNome}`}
          className="fixed inset-0 z-40 flex items-center justify-center bg-stone-900/40 p-4"
        >
          <div className="w-full max-w-sm space-y-3 rounded-xl bg-white p-5 text-left shadow-lg">
            <h2 className="text-base font-medium">Importo bonifico diverso — {bambinoNome}</h2>
            <p className="text-xs text-stone-600">Importo atteso: {formattaImporto(totale)}</p>
            <label className="block text-xs text-stone-600">
              Importo ricevuto (€)
              <input
                ref={importoRef}
                type="number"
                min={0}
                step={0.01}
                aria-label="Importo ricevuto (€)"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              />
            </label>
            <label className="block text-xs text-stone-600">
              Nota (obbligatoria)
              <input
                ref={notaRef}
                placeholder="Motivo della differenza"
                aria-label="Nota bonifico"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              />
            </label>
            <label className="block text-xs text-stone-600">
              Mese su cui conteggiare la differenza
              <input
                ref={meseRef}
                type="month"
                min={meseMinimo}
                defaultValue={meseSuggerito}
                aria-label="Mese su cui conteggiare la differenza"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              />
            </label>
            {!esitoModale.ok && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-800">
                <p className="font-medium">{esitoModale.messaggio}</p>
                {esitoModale.dettaglio && <p className="mt-1 text-xs text-red-600">{esitoModale.dettaglio}</p>}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setApertoModale(false)}
                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={pendingModale}
                aria-busy={pendingModale}
                onClick={confermaImportoErrato}
                className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingModale ? 'Attendere…' : 'Conferma'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
