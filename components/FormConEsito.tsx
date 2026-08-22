'use client';

import { useFormState } from 'react-dom';
import type { ReactNode } from 'react';

// Esito di un'azione lato server, per il feedback "done"/"ko" di
// specs/05 - feedback.md: { ok: true } = nessun errore da mostrare
// (l'effetto dell'azione, es. il nuovo elemento in lista, è già la
// conferma — niente notifiche aggiuntive, vedi "Regole" nel requisito);
// { ok: false } = errore, con un messaggio chiaro e un dettaglio
// tecnico per un troubleshooting rapido.
export type EsitoAzione = { ok: true } | { ok: false; messaggio: string; dettaglio?: string };

export const ESITO_INIZIALE: EsitoAzione = { ok: true };

// Avvolge un form la cui server action segue la firma di useFormState
// (riceve lo stato precedente come primo argomento, restituisce il
// nuovo EsitoAzione). Mostra un banner d'errore solo quando serve:
// nessun elemento aggiuntivo in caso di successo.
export function FormConEsito({
  action,
  children,
  className,
}: {
  action: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
  children: ReactNode;
  className?: string;
}) {
  const [esito, formAction] = useFormState(action, ESITO_INIZIALE);

  return (
    <form action={formAction} className={className}>
      {children}
      {!esito.ok && (
        <div
          role="alert"
          className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-800"
        >
          <p className="font-medium">{esito.messaggio}</p>
          {esito.dettaglio && <p className="mt-1 text-xs text-red-600">{esito.dettaglio}</p>}
        </div>
      )}
    </form>
  );
}
