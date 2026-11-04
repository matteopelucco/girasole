'use client';

import { createContext, useActionState, useContext, useRef, useState, type ReactNode } from 'react';
import { useAnnullaResetForm } from './useAnnullaResetForm';
import { Avviso } from '@/components/ui/avviso';
import { Campo } from '@/components/ui/campo';
import { Etichetta, TestoErrore } from '@/components/ui/etichetta';
import { avvisoGettoneSuperaAbbonamento, parseImportoOpzionale, TESTO_AVVISO_GETTONE, type VocePrePost } from '@/lib/prezzi';
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

// Testo scritto in ogni campo del form (nome -> testo), anche non salvato: serve
// all'avviso sul gettone (COS-13, PRZ-11), che confronta due campi dello stesso
// form. Un campo non ancora toccato non c'è: vale il suo valore iniziale.
type ContestoValori = { valori: Record<string, string>; imposta: (nome: string, testo: string) => void };
const ContestoValoriCampi = createContext<ContestoValori>({ valori: {}, imposta: () => {} });

// Importo di un campo per il confronto dei prezzi: vuoto o non valido vale 0 (nessun
// avviso; l'errore, se c'è, lo dà il salvataggio).
function importoPerConfronto(testo: string): number {
  const risultato = parseImportoOpzionale(testo);
  return risultato.ok ? risultato.valore : 0;
}

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
  const [valori, setValori] = useState<Record<string, string>>({});
  const contestoValori: ContestoValori = {
    valori,
    imposta: (nome, testo) => setValori((attuali) => (attuali[nome] === testo ? attuali : { ...attuali, [nome]: testo })),
  };

  // I valori scritti devono restare dopo un errore, per poterli correggere.
  useAnnullaResetForm(formRef, chiave);

  return (
    <ContestoImporti.Provider value={stato}>
     <ContestoValoriCampi.Provider value={contestoValori}>
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
     </ContestoValoriCampi.Provider>
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
  avvisoSeVuoto,
  avvisoGettone,
}: {
  name: string;
  etichetta: string;
  // Se l'etichetta visibile è breve ("Prezzo (€)"), il nome completo letto dai
  // lettori di schermo.
  nomeAccessibile?: string;
  defaultValue: string;
  className?: string;
  classeCampo?: string;
  // Se indicato, testo di un avviso (NON un errore: niente role="alert") mostrato
  // finché il campo, tolti gli spazi, è vuoto; collegato al campo con
  // `aria-describedby`. Non blocca il salvataggio.
  avvisoSeVuoto?: string;
  // Solo per i campi del prezzo di un gettone (COS-13, PRZ-11): se il valore
  // scritto (anche non salvato) è maggiore del prezzo dell'abbonamento della
  // stessa voce (altro campo dello stesso form, `abbonamento`), compare un
  // avviso con la scritta e il campo prende un rosso tenue. Non è un errore:
  // niente `role="alert"`, niente `aria-invalid`, il salvataggio non cambia.
  avvisoGettone?: { voce: VocePrePost; abbonamento: { name: string; defaultValue: string } };
}) {
  const [valore, setValore] = useState(defaultValue);
  const stato = useContext(ContestoImporti);
  const { valori, imposta } = useContext(ContestoValoriCampi);
  const errore = stato.esito === 'errore' ? stato.errori?.[name] : undefined;
  const id = `campo-${name}`;
  const idErrore = `${id}-errore`;
  const idAvviso = `${id}-avviso`;
  const mostraAvviso = Boolean(avvisoSeVuoto) && valore.trim() === '' && !errore;
  const idAvvisoGettone = `${id}-avviso-gettone`;
  const mostraAvvisoGettone =
    avvisoGettone !== undefined &&
    avvisoGettoneSuperaAbbonamento({
      prezzoGettone: importoPerConfronto(valore),
      prezzoAbbonamento: importoPerConfronto(valori[avvisoGettone.abbonamento.name] ?? avvisoGettone.abbonamento.defaultValue),
    });
  const idDescrizione = errore ? idErrore : mostraAvviso ? idAvviso : mostraAvvisoGettone ? idAvvisoGettone : undefined;
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
        onChange={(e) => {
          setValore(e.target.value);
          imposta(name, e.target.value);
        }}
        aria-describedby={idDescrizione}
        className={cn('mt-1 w-full', classeCampo, mostraAvvisoGettone && 'border-danger-border bg-danger-soft')}
      />
      {mostraAvvisoGettone && avvisoGettone && (
        <p
          id={idAvvisoGettone}
          data-testid={`avviso-gettone-${avvisoGettone.voce}-asilo`}
          className="mt-1 text-xs font-medium text-danger-text"
        >
          {TESTO_AVVISO_GETTONE[avvisoGettone.voce]}
        </p>
      )}
      {mostraAvviso && (
        <p id={idAvviso} data-testid="avviso-retta-vuota" role="status" className="mt-1 text-xs font-medium text-warning-text">
          {avvisoSeVuoto}
        </p>
      )}
      {errore && (
        <TestoErrore id={idErrore} role="alert">
          {errore}
        </TestoErrore>
      )}
    </div>
  );
}
