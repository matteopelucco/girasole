'use client';

import { useId, useState, useTransition } from 'react';
import { ESITO_INIZIALE, type EsitoAzione } from './FormConEsito';
import { Avviso } from './ui/avviso';
import { Pulsante } from './ui/pulsante';
import { TestoLungo } from './ui/testo-lungo';
import { NOTA_PAGAMENTO_MAX } from '@/lib/pagamentiBambino';

// Nota privata di una riga di "Pagamenti bambino" (specs/60, PAG-05..PAG-08):
// un campo di testo con "Salva" per riga e una conferma visibile ("Nota
// salvata"). Solo l'admin la vede. Come VerificaBonifico, niente <form>: il
// salvataggio è un'azione chiamata dentro uno startTransition, con l'esito
// tenuto a mano. `salva` arriva già legata alla comunicazione.
export function NotaPagamento({
  notaIniziale,
  nomeCampo,
  salva,
}: {
  notaIniziale: string | null;
  // Nome accessibile del campo, es. "Nota per Mario Rossi, settembre 2026".
  nomeCampo: string;
  salva: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
}) {
  const idAiuto = useId();
  const [testo, setTesto] = useState(notaIniziale ?? '');
  const [esito, setEsito] = useState<EsitoAzione>(ESITO_INIZIALE);
  const [salvata, setSalvata] = useState(false);
  const [pending, avvia] = useTransition();

  function conferma() {
    const dati = new FormData();
    dati.set('nota', testo);
    avvia(async () => {
      const risultato = await salva(ESITO_INIZIALE, dati);
      setEsito(risultato);
      setSalvata(risultato.ok);
    });
  }

  return (
    <div className="flex min-w-56 flex-col gap-1">
      <TestoLungo
        value={testo}
        onChange={(e) => {
          setTesto(e.target.value);
          setSalvata(false);
        }}
        maxLength={NOTA_PAGAMENTO_MAX}
        rows={2}
        misura="piccolo"
        aria-label={nomeCampo}
        aria-describedby={idAiuto}
        className="w-full"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Pulsante
          variante="secondario"
          misura="piccolo"
          disabled={pending}
          aria-busy={pending}
          onClick={conferma}
        >
          {pending ? 'Attendere…' : 'Salva'}
        </Pulsante>
        <span id={idAiuto} className="text-xs text-stone-500">
          {[...testo].length}/{NOTA_PAGAMENTO_MAX} · solo per te, non va ai genitori
        </span>
        {salvata && (
          <span role="status" className="text-xs font-medium text-emerald-800">
            Nota salvata
          </span>
        )}
      </div>
      {!esito.ok && (
        <Avviso tono="errore" className="p-2 text-xs">
          <p className="font-medium">{esito.messaggio}</p>
          {esito.dettaglio && <p className="mt-1 text-xs text-danger">{esito.dettaglio}</p>}
        </Avviso>
      )}
    </div>
  );
}
