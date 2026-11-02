'use client';

import { createContext, useActionState, useContext, useRef, type ReactNode } from 'react';
import { useAnnullaResetForm } from './useAnnullaResetForm';
import { Avviso } from '@/components/ui/avviso';
import { Campo } from '@/components/ui/campo';
import { Etichetta, TestoErrore } from '@/components/ui/etichetta';
import { cn } from '@/lib/utils';

// Form con importi in euro (sezione "Prezzi", specs/62, e scheda Costi del
// bambino, specs/55): un importo non valido è rifiutato con un messaggio SUL
// CAMPO (mai trasformato in 0), i campi mantengono quanto scritto e il
// salvataggio è tutto o niente (decide l'azione sul server).
//
// L'azione restituisce uno `StatoImporti`:
// - `salvato`: tutto salvato (la pagina si ricarica da sola con i valori nuovi);
// - `errore` con `errori`: un messaggio per ogni campo sbagliato (nome del campo
//   -> messaggio); in questo caso non viene scritto nulla;
// - `errore` con `messaggio`: errore generale (es. dati vecchi, database).
export type StatoImporti =
  | { esito: 'iniziale' }
  | { esito: 'salvato' }
  | { esito: 'errore'; errori?: Record<string, string>; messaggio?: string; dettaglio?: string };

export const STATO_IMPORTI_INIZIALE: StatoImporti = { esito: 'iniziale' };

const ContestoImporti = createContext<StatoImporti>(STATO_IMPORTI_INIZIALE);

export function FormImporti({
  action,
  children,
  className,
  chiave,
  messaggioSalvato,
}: {
  action: (statoPrecedente: StatoImporti, formData: FormData) => Promise<StatoImporti>;
  children: ReactNode;
  className?: string;
  // Cambia a ogni salvataggio riuscito (es. la data dell'ultimo salvataggio): il
  // form viene ricreato e i campi mostrano i valori salvati, già normalizzati
  // (due decimali, virgola). Lo stato dell'esito vive fuori da questa chiave.
  chiave?: string;
  // Se indicato, testo mostrato dopo un salvataggio riuscito.
  messaggioSalvato?: string;
}) {
  const [stato, formAction] = useActionState(action, STATO_IMPORTI_INIZIALE);
  const formRef = useRef<HTMLFormElement>(null);

  // I valori scritti devono restare dopo un errore, per poterli correggere.
  useAnnullaResetForm(formRef, chiave);

  return (
    <ContestoImporti.Provider value={stato}>
      <form key={chiave} ref={formRef} action={formAction} className={className}>
        {children}
        {stato.esito === 'salvato' && messaggioSalvato && (
          <p role="status" className="text-sm font-medium text-success-text">
            {messaggioSalvato}
          </p>
        )}
        {stato.esito === 'errore' && stato.messaggio && (
          <Avviso tono="errore" className="rounded-lg p-2">
            <p className="font-medium">{stato.messaggio}</p>
            {stato.dettaglio && <p className="mt-1 text-xs">{stato.dettaglio}</p>}
          </Avviso>
        )}
      </form>
    </ContestoImporti.Provider>
  );
}

// Campo di testo per un importo, dentro un `FormImporti`: mostra l'errore del
// proprio `name` (se c'è) con `role="alert"` e `aria-invalid`. Il valore si scrive
// come testo ("165,50"): un campo `number` accetterebbe "1e2" e non lascerebbe
// vedere al server ciò che l'utente ha scritto.
export function CampoImporto({
  name,
  etichetta,
  nomeAccessibile,
  defaultValue,
  className,
  classeCampo,
}: {
  name: string;
  etichetta: string;
  // Se l'etichetta visibile è breve ("Prezzo (€)"), il nome completo letto dai
  // lettori di schermo.
  nomeAccessibile?: string;
  defaultValue: string;
  className?: string;
  classeCampo?: string;
}) {
  const stato = useContext(ContestoImporti);
  const errore = stato.esito === 'errore' ? stato.errori?.[name] : undefined;
  const id = `campo-${name}`;
  const idErrore = `${id}-errore`;
  return (
    <div className={className}>
      <Etichetta htmlFor={id} className="text-xs font-normal text-stone-600">
        {etichetta}
      </Etichetta>
      <Campo
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        defaultValue={defaultValue}
        aria-label={nomeAccessibile}
        aria-invalid={errore ? true : undefined}
        aria-describedby={errore ? idErrore : undefined}
        className={cn('mt-1 w-full', classeCampo)}
      />
      {errore && (
        <TestoErrore id={idErrore} role="alert">
          {errore}
        </TestoErrore>
      )}
    </div>
  );
}
