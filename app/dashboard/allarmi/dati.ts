import { cache } from 'react';
import { requireProfilo } from '@/lib/auth';
import { calcolaDatiAllarmiUtente } from '@/lib/allarmiDati';
import { componiAllarmi, type Allarme, type InputElencoAllarmi } from '@/lib/elencoAllarmi';

// Dati degli allarmi dell'utente corrente (specs/07 - allarmi.md), letti
// una sola volta per richiesta (`cache` di React): la campanella, che sta
// su ogni pagina, la pagina "Allarmi" e i banner della dashboard usano lo
// stesso risultato, quindi coincidono e le query non si ripetono. Null per
// chi non ha la campanella (genitore): in quel caso non si legge nulla.
export const caricaDatiAllarmiCorrenti = cache(async (): Promise<InputElencoAllarmi | null> => {
  const { supabase, user, profilo } = await requireProfilo();
  return calcolaDatiAllarmiUtente(supabase, user.id, profilo);
});

// Elenco degli allarmi composto da quei dati (campanella e pagina "Allarmi").
export const caricaAllarmiCorrenti = cache(async (): Promise<Allarme[] | null> => {
  const dati = await caricaDatiAllarmiCorrenti();
  return dati && componiAllarmi(dati);
});
