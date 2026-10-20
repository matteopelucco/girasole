'use client';

import { useState, type ReactNode } from 'react';
import { FormConEsito, type EsitoAzione } from './FormConEsito';
import { PulsanteInvio } from './PulsanteInvio';
import { Pulsante } from './ui/pulsante';

// Le classi del pulsante vengono da `Pulsante` (components/ui/pulsante.tsx):
// qui restano solo le differenze di tono. "distruttivo": il pulsante che
// apre la conferma è un secondario con bordo e testo rossi, quello che
// conferma è la variante "pericolo". "neutro" (ambra): niente variante
// dedicata, si parte dal primario e si cambia il colore.
const PALETTE = {
  distruttivo: {
    apri: { variante: 'secondario', className: 'border-red-300 bg-transparent text-danger hover:bg-danger-soft' },
    conferma: { variante: 'pericolo', className: '' },
    box: 'border-danger-border bg-danger-soft',
    testo: 'text-danger-text',
  },
  neutro: {
    apri: { variante: 'primario', className: 'bg-warning hover:bg-amber-800' },
    conferma: { variante: 'primario', className: 'bg-warning hover:bg-amber-800' },
    box: 'border-amber-300 bg-warning-soft',
    testo: 'text-warning-text',
  },
} as const;

// Pulsante con conferma esplicita sì/annulla prima di un'azione
// irreversibile (specs/15 - memo.md, "cancellazione di un avviso";
// specs/16 - comunicazione-pasti-rojac.md, "il pulsante chiede conferma
// prima di comunicare"): evita azioni accidentali con un tap solo.
// `tono` sceglie solo la palette: "distruttivo" (rosso) per le
// eliminazioni, "neutro" (ambra) per altre azioni irreversibili ma non
// distruttive.
export function ConfermaAzione({
  azione,
  campiNascosti,
  etichetta,
  messaggioConferma,
  etichettaConferma = 'Sì',
  tono = 'distruttivo',
  titoloPopupErrore,
}: {
  azione: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
  campiNascosti: Record<string, string>;
  etichetta: string;
  messaggioConferma: ReactNode;
  etichettaConferma?: string;
  tono?: keyof typeof PALETTE;
  // Se indicato, un'azione fallita apre un popup bloccante con questo
  // titolo (vedi FormConEsito) invece del solo banner discreto.
  titoloPopupErrore?: string;
}) {
  const [confermaRichiesta, setConfermaRichiesta] = useState(false);
  const palette = PALETTE[tono];

  if (!confermaRichiesta) {
    return (
      <Pulsante
        variante={palette.apri.variante}
        misura="normale"
        onClick={() => setConfermaRichiesta(true)}
        className={palette.apri.className}
      >
        {etichetta}
      </Pulsante>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-lg border p-3 ${palette.box}`}>
      <span className={`text-sm ${palette.testo}`}>{messaggioConferma}</span>
      <FormConEsito action={azione} titoloPopupErrore={titoloPopupErrore}>
        {Object.entries(campiNascosti).map(([nome, valore]) => (
          <input key={nome} type="hidden" name={nome} value={valore} />
        ))}
        <PulsanteInvio variante={palette.conferma.variante} misura="piccolo" className={palette.conferma.className}>
          {etichettaConferma}
        </PulsanteInvio>
      </FormConEsito>
      <Pulsante variante="secondario" misura="piccolo" onClick={() => setConfermaRichiesta(false)} className="font-normal">
        Annulla
      </Pulsante>
    </div>
  );
}
