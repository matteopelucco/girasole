'use client';

import { useEffect, type RefObject } from 'react';

// React 19 svuota da sé i campi non controllati di un form (li riporta al valore
// iniziale) a ogni invio con `action={funzione}`, anche se l'azione ha
// restituito un errore, e lo fa quando la risposta del server è già arrivata:
// chi ha già ricominciato a digitare perde i valori. Nei form dove i dati scritti
// devono restare (modifica di dati già salvati, errore da correggere) si annulla
// quel reset. Serve un ascoltatore nativo: `onReset` di React non basta.
// `chiave` è la `key` del form: se cambia, il form è un elemento nuovo e
// l'ascoltatore va rimesso.
export function useAnnullaResetForm(formRef: RefObject<HTMLFormElement | null>, chiave?: string | number) {
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const annulla = (evento: Event) => evento.preventDefault();
    form.addEventListener('reset', annulla);
    return () => form.removeEventListener('reset', annulla);
  }, [formRef, chiave]);
}
