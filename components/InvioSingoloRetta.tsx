'use client';

import { useRef, useState } from 'react';
import { PulsanteInvio } from './PulsanteInvio';
import { Finestra } from './ui/finestra';
import { Pulsante } from './ui/pulsante';
import { formattaImporto, sostituisciPlaceholder } from '@/lib/comunicazioneRetta';
import { formattaMeseItaliano } from '@/lib/date';

// Suffisso del name di ciascun campo importo MODIFICABILE della riga
// (vedi app/admin/rette/page.tsx) → placeholder corrispondente nel
// template (specs/56, `{{...}}`). Retta, marca da bollo, costo pasti e
// credito/debito non sono qui: non sono campi del form (non
// modificabili da questa tabella — retta si cambia sulla scheda del
// bambino, la marca da bollo non è modificabile da nessuna parte
// essendo un importo fisso per legge, il costo pasti è la proiezione
// automatica sui giorni di apertura, il credito/debito si corregge
// dalla scheda del bambino, specs/58), arrivano come prop fisse
// (rettaMensile/marcaDaBollo/costoPasti/creditoDebito sotto). Condiviso
// da apriAnteprima sotto: un solo punto che elenca le voci modificabili,
// non ripetuto due volte.
const CAMPI_IMPORTO: readonly [suffisso: string, placeholder: string][] = [
  ['conguaglio_pasti', 'conguaglio_pasti'],
  ['pre_asilo', 'costo_pre_asilo'],
  ['post_asilo', 'costo_post_asilo'],
  ['costi_extra', 'costi_extra'],
];

// Pulsante "Invia comunicazione" per un solo bambino, con anteprima
// (specs/56, scenario "inviare la comunicazione a un solo bambino con
// anteprima"): mostra a/oggetto/corpo così come verranno inviati prima
// di chiedere conferma — non un window.confirm a riga singola (come per
// l'invio massimo, vedi PulsanteInvio), perché qui il contenuto da far
// controllare è strutturato e potenzialmente lungo (il corpo della
// mail).
//
// L'anteprima è calcolata qui, lato client: retta e marca da bollo
// arrivano come prop fisse (non modificabili da questa tabella),
// le altre voci sono lette dai valori attuali dei campi della riga (che
// l'admin può aver corretti ad-hoc) tramite il DOM — stesso genere di
// lettura diretta già usato dal pulsante "Copia" di
// components/RigaOreLavoro.tsx — invece di un round-trip al server: i
// dati necessari (template, valori dei campi) sono già tutti disponibili
// in pagina, e le stesse funzioni pure di formattazione/sostituzione
// placeholder usate lato server (lib/comunicazioneRetta.ts) sono sicure
// da eseguire anche nel browser (nessun I/O).
//
// Il pulsante "Conferma invio" nel popup è un submit del <form> che
// contiene l'intera tabella (Invia comunicazioni) con un formAction
// proprio (bind di bambinoId) — stesso motivo per cui "Annulla invio" fa
// lo stesso: questo componente non può creare un proprio <form>, ci si
// troverebbe annidato in quello della tabella (HTML non valido) e fuori
// dai campi che deve leggere.
export function InvioSingoloRetta({
  bambinoId,
  nome,
  cognome,
  email,
  mese,
  rettaMensile,
  marcaDaBollo,
  costoPasti,
  creditoDebito,
  notaCreditoDebito,
  oggettoTemplate,
  corpoTemplate,
  formAction,
  formActionSenzaInvio,
}: {
  bambinoId: string;
  nome: string;
  cognome: string;
  email: string;
  mese: string;
  rettaMensile: number;
  marcaDaBollo: number;
  costoPasti: number;
  creditoDebito: number;
  notaCreditoDebito: string | null;
  oggettoTemplate: string;
  corpoTemplate: string;
  formAction: (formData: FormData) => void | Promise<void>;
  // Stessa azione con l'invio e-mail disattivato (fissato dalla pagina).
  formActionSenzaInvio: (formData: FormData) => void | Promise<void>;
}) {
  const [anteprima, setAnteprima] = useState<{ oggetto: string; corpo: string } | null>(null);
  const bottoneRef = useRef<HTMLButtonElement>(null);

  function apriAnteprima() {
    const riga = bottoneRef.current?.closest('tr');
    if (!riga) return;

    const valori: Record<string, string> = {
      nome,
      cognome,
      mese: formattaMeseItaliano(mese),
      retta_mensile: formattaImporto(rettaMensile),
      marca_da_bollo: formattaImporto(marcaDaBollo),
      costo_pasti: formattaImporto(costoPasti),
      credito_debito: formattaImporto(creditoDebito),
      nota_credito_debito: notaCreditoDebito ?? '',
    };
    let totale = rettaMensile + marcaDaBollo + costoPasti + creditoDebito;
    for (const [suffisso, placeholder] of CAMPI_IMPORTO) {
      const campo = riga.querySelector<HTMLInputElement>(`[name="${suffisso}_${bambinoId}"]`);
      const valore = campo ? Number(campo.value) || 0 : 0;
      valori[placeholder] = formattaImporto(valore);
      totale += valore;
    }
    valori.totale = formattaImporto(totale);

    const campoNota = riga.querySelector<HTMLInputElement>(`[name="note_extra_${bambinoId}"]`);
    valori.note_costi_extra = campoNota?.value ?? '';

    setAnteprima({
      oggetto: sostituisciPlaceholder(oggettoTemplate, valori),
      corpo: sostituisciPlaceholder(corpoTemplate, valori),
    });
  }

  return (
    <>
      <Pulsante
        ref={bottoneRef}
        variante="secondario"
        misura="piccolo"
        onClick={apriAnteprima}
        className="border-emerald-300 bg-transparent px-2 py-0.5 text-success hover:bg-success-soft"
      >
        Invia comunicazione
      </Pulsante>

      {anteprima && (
        <Finestra
          titolo={`Anteprima comunicazione — ${nome} ${cognome}`}
          nome={`Anteprima comunicazione per ${nome} ${cognome}`}
          larghezza="lg"
          onChiudi={() => setAnteprima(null)}
        >
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase text-stone-500">A</dt>
              <dd>{email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-stone-500">Oggetto</dt>
              <dd>{anteprima.oggetto}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-stone-500">Corpo</dt>
              <dd className="mt-1 whitespace-pre-wrap rounded-lg border border-border bg-stone-50 p-2 text-stone-700">
                {anteprima.corpo}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Pulsante variante="secondario" misura="normale" onClick={() => setAnteprima(null)}>
              Annulla
            </Pulsante>
            <PulsanteInvio formAction={formAction} mantieniTesto variante="primario" misura="normale">
              Conferma invio
            </PulsanteInvio>
            {/* Stessa azione di "Conferma invio", ma con l'invio e-mail
                disattivato (specs/56). Comando tenue, non un pulsante. */}
            <PulsanteInvio
              formAction={formActionSenzaInvio}
              mantieniTesto
              className="rounded-base px-2 py-1.5 text-sm text-stone-600 underline hover:text-stone-900"
            >
              Conferma senza inviare
            </PulsanteInvio>
          </div>
        </Finestra>
      )}
    </>
  );
}
