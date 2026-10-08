import { cache } from 'react';
import { requireProfilo } from '@/lib/auth';
import { calcolaAllarmiUtente } from '@/lib/allarmiDati';
import type { Allarme } from '@/lib/elencoAllarmi';

// Allarmi dell'utente corrente (specs/07 - allarmi.md), calcolati una sola
// volta per richiesta (`cache` di React): la campanella, che sta su ogni
// pagina, e la pagina "Allarmi" leggono lo stesso risultato, quindi il
// numero coincide con l'elenco e le query non si ripetono. Null per chi
// non ha la campanella (genitore): in quel caso non si calcola nulla.
export const caricaAllarmiCorrenti = cache(async (): Promise<Allarme[] | null> => {
  const { supabase, user, profilo } = await requireProfilo();
  return calcolaAllarmiUtente(supabase, user.id, profilo);
});
