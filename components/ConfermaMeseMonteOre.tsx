'use client';

import { useFormState } from 'react-dom';
import { ESITO_INIZIALE, type EsitoAzione } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { formattaOreConSegno } from '@/lib/oreLavoro';
import { saldoMonteOreBreve } from '@/lib/monteOre';

// Pulsante "Conferma" della riga di un mese chiuso nel "Calcolo mese per mese"
// (specs/19, MOR-01..MOR-07). Il componente resta montato anche quando la
// riga non ha più nulla da confermare, così il messaggio "Mese già confermato"
// (richiesta in più di un doppio click o di un secondo admin) non sparisce con
// l'aggiornamento della riga. La parte mostrata è solo un'indicazione: il
// valore che viene registrato lo ricalcola il server a ogni richiesta.
export function ConfermaMeseMonteOre({
  utenteId,
  mese,
  parte,
  haMovimenti,
  conferma,
}: {
  utenteId: string;
  mese: string;
  // Parte non confermata mostrata (0 = niente da confermare).
  parte: number;
  // Il mese ha già movimenti di competenza: la parte è "residua".
  haMovimenti: boolean;
  conferma: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
}) {
  const [esito, formAction] = useFormState(conferma, ESITO_INIZIALE);

  return (
    <div className="mt-1 text-xs font-normal">
      {parte !== 0 && (
        <form action={formAction} className="flex flex-wrap items-center justify-end gap-2">
          <input type="hidden" name="utente_id" value={utenteId} />
          <input type="hidden" name="mese" value={mese} />
          <span className="text-stone-700">
            {haMovimenti ? `${formattaOreConSegno(parte)}h non confermate` : saldoMonteOreBreve(parte)}
          </span>
          <PulsanteInvio variante="secondario" misura="piccolo">
            {haMovimenti ? 'Conferma la differenza residua' : 'Conferma'}
          </PulsanteInvio>
        </form>
      )}
      {esito.ok && esito.avviso && (
        <p role="status" className="text-stone-700">
          {esito.avviso}
        </p>
      )}
      {!esito.ok && (
        <p role="alert" className="mt-1 text-red-800">
          {esito.messaggio}
          {esito.dettaglio ? ` (${esito.dettaglio})` : ''}
        </p>
      )}
    </div>
  );
}
