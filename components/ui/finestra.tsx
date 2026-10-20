'use client';

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// Finestra di dialogo unica dell'app (issue #342, specs/01 - ux.md, "Sistema
// grafico"). Sostituisce i `div` a tutto schermo scritti a mano, che
// dichiaravano `aria-modal` ma non tenevano il focus nella finestra.
//
// Usa il <dialog> nativo con showModal() (come faceva già DialogErrore), non
// una libreria: zero byte in più nel browser e, soprattutto, la finestra
// resta DENTRO il punto della pagina in cui è scritta. Una finestra "portata"
// in fondo al body (come fa Radix) uscirebbe dal <form> che la contiene e i
// suoi pulsanti di invio smetterebbero di inviare (es. "Conferma invio" nella
// tabella delle rette, specs/56).
//
// Comportamento garantito dal browser: il focus entra nella finestra, il
// resto della pagina è inerte (Tab non ci arriva), Esc chiude. In più, qui:
// - Tab e Maiusc+Tab girano dentro la finestra (il browser, dall'ultimo
//   elemento, porterebbe il focus fuori dal documento);
// - alla chiusura il focus torna all'elemento che aveva il focus all'apertura
//   (il pulsante che ha aperto la finestra), anche se chi la usa la chiude
//   smontandola;
// - titolo e descrizione sono collegati con aria-labelledby/-describedby;
//   `nome` imposta invece un nome accessibile esplicito (aria-label) quando
//   deve restare quello storico.
//
// Chi la usa la monta quando serve (`{aperta && <Finestra …>}`) e chiude in
// `onChiudi`, che parte per Esc, per il clic sullo sfondo (se
// `chiudiSuSfondo`) e per ogni altra chiusura del <dialog>. In alternativa
// la lascia montata e governa `aperta` (DialogErrore).
export type FinestraProps = {
  titolo: ReactNode;
  descrizione?: ReactNode;
  // Nome accessibile esplicito, al posto del titolo.
  nome?: string;
  // "avviso" è la variante dei popup d'errore (bordo e titolo rossi) e usa il
  // ruolo alertdialog, che i lettori di schermo annunciano subito.
  variante?: 'normale' | 'avviso';
  larghezza?: 'sm' | 'md' | 'lg';
  aperta?: boolean;
  // Chiude anche toccando fuori dalla finestra. Per le azioni distruttive o
  // da riconoscere esplicitamente si lascia spento.
  chiudiSuSfondo?: boolean;
  onChiudi?: () => void;
  children?: ReactNode;
};

const ELEMENTI_FOCALIZZABILI =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const LARGHEZZE = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' } as const;

export function Finestra({
  titolo,
  descrizione,
  nome,
  variante = 'normale',
  larghezza = 'md',
  aperta = true,
  chiudiSuSfondo = false,
  onChiudi,
  children,
}: FinestraProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const apertaDa = useRef<HTMLElement | null>(null);
  const idTitolo = useId();
  const idDescrizione = useId();
  const avviso = variante === 'avviso';

  function ripristinaFocus() {
    const elemento = apertaDa.current;
    if (elemento?.isConnected) elemento.focus();
  }

  // Il <dialog> modale rende inerte la pagina, ma dall'ultimo elemento Tab
  // porta il focus fuori dal documento (barra del browser). Qui il giro si
  // chiude dentro la finestra: Tab sull'ultimo va al primo, Maiusc+Tab sul
  // primo va all'ultimo.
  function trattieniTab(evento: KeyboardEvent<HTMLDialogElement>) {
    const dialog = dialogRef.current;
    if (evento.key !== 'Tab' || !dialog) return;
    // Un'altra finestra aperta dentro questa (es. DialogErrore) gestisce i
    // propri Tab.
    if ((evento.target as HTMLElement).closest('dialog') !== dialog) return;
    const focalizzabili = Array.from(
      dialog.querySelectorAll<HTMLElement>(ELEMENTI_FOCALIZZABILI),
    ).filter((elemento) => elemento.getClientRects().length > 0);
    if (focalizzabili.length === 0) {
      evento.preventDefault();
      return;
    }
    const primo = focalizzabili[0];
    const ultimo = focalizzabili[focalizzabili.length - 1];
    const attivo = document.activeElement;
    if (evento.shiftKey && (attivo === primo || attivo === dialog)) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && attivo === ultimo) {
      evento.preventDefault();
      primo.focus();
    }
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (aperta) {
      if (!dialog.open) {
        apertaDa.current = document.activeElement as HTMLElement | null;
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
    // Smontata (o chiusa da `aperta`): il focus torna dov'era. Il <dialog>
    // sparito dal DOM non lo fa da solo.
    return () => ripristinaFocus();
  }, [aperta]);

  return (
    <dialog
      ref={dialogRef}
      role={avviso ? 'alertdialog' : undefined}
      aria-label={nome}
      aria-labelledby={nome ? undefined : idTitolo}
      aria-describedby={descrizione ? idDescrizione : undefined}
      onClose={() => {
        ripristinaFocus();
        onChiudi?.();
      }}
      onKeyDown={trattieniTab}
      onClick={(evento) => {
        // Il <dialog> è l'obiettivo del clic solo se si tocca lo sfondo:
        // il contenuto sta tutto nel div interno.
        if (chiudiSuSfondo && evento.target === evento.currentTarget) dialogRef.current?.close();
      }}
      className={cn(
        'm-auto max-h-[85vh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl bg-popover p-0 text-left text-popover-foreground shadow-xl backdrop:bg-stone-900/50',
        LARGHEZZE[larghezza],
        avviso && 'border-2 border-danger-border',
      )}
    >
      <div className="p-5">
        <h2
          id={idTitolo}
          className={cn('text-base font-semibold', avviso ? 'text-danger-text' : 'text-foreground')}
        >
          {titolo}
        </h2>
        {descrizione && (
          <div id={idDescrizione} className="mt-2 text-sm text-stone-700">
            {descrizione}
          </div>
        )}
        {children}
      </div>
    </dialog>
  );
}
