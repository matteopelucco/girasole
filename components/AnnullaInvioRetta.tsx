'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { Pulsante } from './ui/pulsante';

// "Annulla invio" nella finestra "Gestisci" di "Pagamenti bambino" (specs/60,
// PAG-27; issue #435): la stessa azione di "Rette" (`annullaComunicazioneRetta`,
// specs/56), già legata a bambino e mese dal chiamante. La pagina lo mostra
// solo per il mese corrente con il bonifico da verificare; il server lo
// ricontrolla. Niente <form>: come VerificaBonifico, l'azione si chiama dentro
// uno startTransition dopo la conferma. Se riesce, la riga torna "Non ancora
// comunicata" e la finestra sparisce con lei: l'effetto è la conferma
// (specs/05 - feedback.md).
export function AnnullaInvioRetta({
  descrizione,
  annulla,
}: {
  // Es. "Mario Rossi, novembre 2026".
  descrizione: string;
  annulla: (formData: FormData) => Promise<void>;
}) {
  const [pending, avvia] = useTransition();

  function conferma() {
    if (
      !window.confirm(
        `Annullare l'invio della retta di ${descrizione}? La retta e il suo storico delle modifiche vengono cancellati; alla famiglia non parte nessuna mail.`
      )
    ) {
      return;
    }
    avvia(async () => {
      await annulla(new FormData());
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-stone-600">
        Se la mail era sbagliata puoi annullare l&apos;invio: la retta torna da inviare e la nuova mail si invia da{' '}
        <Link href="/admin/rette" className="underline">
          Rette
        </Link>
        .
      </p>
      <Pulsante variante="pericolo" misura="piccolo" disabled={pending} aria-busy={pending} onClick={conferma}>
        {pending ? 'Attendere…' : 'Annulla invio'}
      </Pulsante>
    </div>
  );
}
