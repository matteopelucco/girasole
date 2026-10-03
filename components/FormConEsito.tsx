'use client';

import { useFormState } from 'react-dom';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DialogErrore } from './DialogErrore';

// Esito di un'azione lato server, per il feedback "done"/"ko" di
// specs/05 - feedback.md: { ok: true } = nessun errore da mostrare
// (l'effetto dell'azione, es. il nuovo elemento in lista, è già la
// conferma — niente notifiche aggiuntive, vedi "Regole" nel requisito);
// { ok: false } = errore, con un messaggio chiaro e un dettaglio
// tecnico per un troubleshooting rapido.
//
// `elenco` (opzionale) è l'elenco di tutte le incongruenze da sanare,
// quando un'azione ne rileva più d'una in un colpo solo (es. il
// salvataggio della settimana di ore di lavoro, specs/18): mostrato in
// lista dal banner e dal popup bloccante.
export type EsitoAzione = { ok: true } | { ok: false; messaggio: string; dettaglio?: string; elenco?: string[] };

export const ESITO_INIZIALE: EsitoAzione = { ok: true };

// Avvolge un form la cui server action segue la firma di useFormState
// (riceve lo stato precedente come primo argomento, restituisce il
// nuovo EsitoAzione). Mostra un banner d'errore solo quando serve:
// nessun elemento aggiuntivo in caso di successo.
export function FormConEsito({
  action,
  children,
  className,
  resetSuOk = false,
  titoloPopupErrore,
}: {
  action: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
  children: ReactNode;
  className?: string;
  // Svuota il form (tutti i campi tornano al loro defaultValue) dopo
  // un invio riuscito — per le form di creazione dove l'utente vuole
  // inserirne subito un'altra (specs/15 - memo.md, scenario "il form si
  // svuota dopo aver pubblicato un avviso"). Di default false: le
  // form di modifica (es. aggiornaBambino) devono continuare a mostrare
  // i dati correnti, non svuotarsi.
  resetSuOk?: boolean;
  // Se indicato, un esito negativo apre in più un popup bloccante con
  // questo titolo (components/DialogErrore.tsx, specs/05): per le azioni
  // il cui errore, ignorato, ha conseguenze (es. "Settimana non salvata").
  // Il banner inline resta come ripiego senza JavaScript.
  titoloPopupErrore?: string;
}) {
  const [esito, formAction] = useFormState(action, ESITO_INIZIALE);
  const [chiaveForm, setChiaveForm] = useState(0);
  const primoRender = useRef(true);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (primoRender.current) {
      primoRender.current = false;
      return;
    }
    if (resetSuOk && esito.ok) {
      setChiaveForm((k) => k + 1);
    }
  }, [esito, resetSuOk]);

  return (
    <form key={chiaveForm} ref={formRef} action={formAction} className={className}>
      {children}
      {!esito.ok && titoloPopupErrore && (
        <DialogErrore
          esito={esito}
          titolo={titoloPopupErrore}
          // Chiuso il popup si torna al pulsante che ha avviato l'azione
          // (l'invio lo aveva disabilitato: il browser non sa più dove
          // riportare il focus).
          onChiuso={() => formRef.current?.querySelector<HTMLElement>('button[type="submit"]')?.focus()}
        />
      )}
      {!esito.ok && (
        <div
          // Con il popup è il popup (alertdialog) a essere annunciato: un
          // secondo role="alert" ripeterebbe lo stesso messaggio.
          role={titoloPopupErrore ? undefined : 'alert'}
          className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-800"
        >
          <p className="font-medium">{esito.messaggio}</p>
          {esito.elenco && (
            <ul className="mt-1 list-disc pl-5">
              {esito.elenco.map((voce, indice) => (
                <li key={indice}>{voce}</li>
              ))}
            </ul>
          )}
          {esito.dettaglio && <p className="mt-1 text-xs text-red-600">{esito.dettaglio}</p>}
        </div>
      )}
    </form>
  );
}
