'use client';

import { useId, useState, useTransition } from 'react';
import { ESITO_INIZIALE, type EsitoAzione } from './FormConEsito';
import { Avviso } from './ui/avviso';
import { Campo } from './ui/campo';
import { Finestra } from './ui/finestra';
import { Pulsante } from './ui/pulsante';
import { TestoLungo } from './ui/testo-lungo';
import { formattaImporto } from '@/lib/comunicazioneRetta';
import {
  anteprimaTotale,
  leggiImportoScritto,
  MOTIVO_MODIFICA_MAX,
  NOTA_VOCE_MAX,
  serviziConCoperturaCambiata,
  VOCI_MODIFICABILI,
  type ChiaveVoce,
  type ImportiVoci,
  type NoteVoci,
} from '@/lib/modificaImporti';

// "Modifica importi" di un mese già comunicato, nella colonna "Inviata" di
// "Pagamenti bambino" (specs/60, PAG-02..PAG-10, PAG-15; issue #421): un
// pulsante che apre una finestra con tutte le voci, il motivo obbligatorio e il
// totale che si aggiorna mentre si scrive. Il totale mostrato è solo
// un'anteprima: lo ricalcola il server. Come VerificaBonifico, niente <form>:
// l'azione si chiama dentro uno startTransition, con l'esito tenuto a mano
// (la tabella delle rette può stare dentro altri form). `salva` arriva già
// legata alla comunicazione.
export function ModificaImporti({
  bambinoNome,
  meseEtichetta,
  attuali,
  gettoni,
  bloccata,
  salva,
}: {
  bambinoNome: string;
  // Es. "settembre 2026".
  meseEtichetta: string;
  attuali: ImportiVoci & NoteVoci;
  // Numero dei gettoni: testo non modificabile sotto il rispettivo importo.
  gettoni: { pre: number; post: number };
  // Bonifico già verificato: prima va annullata la verifica (PAG-09).
  bloccata: boolean;
  salva: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
}) {
  const [aperta, setAperta] = useState(false);
  const idSpiegazione = useId();

  return (
    <div className="mt-1">
      <Pulsante
        variante="secondario"
        misura="piccolo"
        disabled={bloccata}
        aria-describedby={bloccata ? idSpiegazione : undefined}
        onClick={() => setAperta(true)}
        className="bg-transparent px-2 py-0.5"
      >
        Modifica importi
      </Pulsante>
      {bloccata && (
        <p id={idSpiegazione} className="mt-1 max-w-48 whitespace-normal text-xs text-stone-500">
          Il bonifico è già verificato: per modificare gli importi annulla prima la verifica.
        </p>
      )}
      {aperta && (
        <Finestra
          titolo={`Modifica importi — ${bambinoNome}, ${meseEtichetta}`}
          nome={`Modifica importi di ${bambinoNome}, ${meseEtichetta}`}
          larghezza="lg"
          onChiudi={() => setAperta(false)}
        >
          <FormModifica
            attuali={attuali}
            gettoni={gettoni}
            salva={salva}
            onFatto={() => setAperta(false)}
            onAnnulla={() => setAperta(false)}
          />
        </Finestra>
      )}
    </div>
  );
}

function testoImporto(valore: number): string {
  return valore.toFixed(2).replace('.', ',');
}

// Il contenuto della finestra: montato a ogni apertura, così riparte sempre
// dai valori registrati.
function FormModifica({
  attuali,
  gettoni,
  salva,
  onFatto,
  onAnnulla,
}: {
  attuali: ImportiVoci & NoteVoci;
  gettoni: { pre: number; post: number };
  salva: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
  onFatto: () => void;
  onAnnulla: () => void;
}) {
  const idBase = useId();
  const [valori, setValori] = useState<Record<ChiaveVoce, string>>(() => {
    const iniziali = {} as Record<ChiaveVoce, string>;
    for (const voce of VOCI_MODIFICABILI) iniziali[voce.chiave] = testoImporto(attuali[voce.chiave]);
    return iniziali;
  });
  const [note, setNote] = useState<NoteVoci>({
    note_costi_extra: attuali.note_costi_extra ?? '',
    nota_credito_debito: attuali.nota_credito_debito ?? '',
  });
  const [motivo, setMotivo] = useState('');
  const [esito, setEsito] = useState<EsitoAzione>(ESITO_INIZIALE);
  const [pending, avvia] = useTransition();

  // Un campo non ancora valido non cambia l'avviso di copertura: vale
  // l'importo di partenza.
  const dopo = {} as ImportiVoci;
  for (const voce of VOCI_MODIFICABILI) {
    dopo[voce.chiave] = leggiImportoScritto(valori[voce.chiave]) ?? attuali[voce.chiave];
  }
  const serviziCambiati = serviziConCoperturaCambiata(attuali, dopo);
  const totale = anteprimaTotale(valori);

  function conferma() {
    const dati = new FormData();
    for (const voce of VOCI_MODIFICABILI) dati.set(voce.chiave, valori[voce.chiave]);
    dati.set('note_costi_extra', note.note_costi_extra ?? '');
    dati.set('nota_credito_debito', note.nota_credito_debito ?? '');
    dati.set('motivo', motivo);
    avvia(async () => {
      const risultato = await salva(ESITO_INIZIALE, dati);
      setEsito(risultato);
      if (risultato.ok) onFatto();
    });
  }

  const notaDi = (chiave: ChiaveVoce): 'note_costi_extra' | 'nota_credito_debito' | null =>
    chiave === 'costi_extra' ? 'note_costi_extra' : chiave === 'credito_debito' ? 'nota_credito_debito' : null;
  const numeroGettoni = (chiave: ChiaveVoce): number | null =>
    chiave === 'gettoni_pre_asilo' ? gettoni.pre : chiave === 'gettoni_post_asilo' ? gettoni.post : null;

  return (
    <div className="mt-3 space-y-3">
      <p className="text-xs text-stone-600">
        Correggi le voci di questo mese. Il totale è sempre la somma delle voci. Il numero dei gettoni non si
        modifica da qui.
      </p>
      <Avviso tono="informazione" className="p-2 text-xs">
        La modifica non invia nessuna mail alla famiglia.
      </Avviso>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {VOCI_MODIFICABILI.map((voce) => {
          const chiaveNota = notaDi(voce.chiave);
          const gettone = numeroGettoni(voce.chiave);
          return (
            <div key={voce.chiave} className="space-y-1">
              <label htmlFor={`${idBase}-${voce.chiave}`} className="block text-xs text-stone-600">
                {voce.etichetta} (€)
              </label>
              <Campo
                id={`${idBase}-${voce.chiave}`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={valori[voce.chiave]}
                onChange={(e) => setValori((v) => ({ ...v, [voce.chiave]: e.target.value }))}
                className="w-full"
              />
              {gettone !== null && <p className="text-xs text-stone-500">{gettone} gettoni</p>}
              {chiaveNota && (
                <>
                  <label htmlFor={`${idBase}-${chiaveNota}`} className="block pt-1 text-xs text-stone-600">
                    Nota {voce.etichetta.toLowerCase()}
                  </label>
                  <Campo
                    id={`${idBase}-${chiaveNota}`}
                    type="text"
                    autoComplete="off"
                    maxLength={NOTA_VOCE_MAX}
                    value={note[chiaveNota] ?? ''}
                    onChange={(e) => setNote((n) => ({ ...n, [chiaveNota]: e.target.value }))}
                    className="w-full"
                  />
                </>
              )}
            </div>
          );
        })}
      </div>

      <p role="status" className="text-sm font-semibold text-stone-900">
        Totale: {formattaImporto(totale)} €
      </p>

      {serviziCambiati.length > 0 && (
        <Avviso tono="attenzione" className="p-2 text-xs">
          {serviziCambiati.join(' e ')}: passando da 0,00 € a un importo (o viceversa) i giorni di questo mese non
          risultano più coperti dall&apos;abbonamento. Cambiano la schermata presenze e i gettoni della retta
          successiva, se non è ancora stata inviata. Una retta successiva già inviata non cambia.
        </Avviso>
      )}

      <div className="space-y-1">
        <label htmlFor={`${idBase}-motivo`} className="block text-xs text-stone-600">
          Motivo della modifica (obbligatorio)
        </label>
        <TestoLungo
          id={`${idBase}-motivo`}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          maxLength={MOTIVO_MODIFICA_MAX}
          rows={2}
          aria-required="true"
          className="w-full"
        />
      </div>

      {!esito.ok && (
        <Avviso tono="errore" className="p-2">
          <p className="font-medium">{esito.messaggio}</p>
          {esito.dettaglio && <p className="mt-1 text-xs text-danger">{esito.dettaglio}</p>}
        </Avviso>
      )}

      <div className="flex justify-end gap-2">
        <Pulsante variante="secondario" misura="normale" onClick={onAnnulla}>
          Annulla
        </Pulsante>
        <Pulsante variante="primario" misura="normale" disabled={pending} aria-busy={pending} onClick={conferma}>
          {pending ? 'Attendere…' : 'Salva'}
        </Pulsante>
      </div>
    </div>
  );
}
