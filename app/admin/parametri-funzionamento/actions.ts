'use server';

import { requireAdmin } from '@/lib/auth';
import {
  messaggioBlocco,
  minutiBloccoRimanenti,
  registraTentativo,
  type StatoTentativi,
} from '@/lib/limiteTentativi';
import { valoriParametriPresenti, type Parametro } from '@/lib/parametriAmbiente';
import { PARAMETRI_VISIBILI } from '@/lib/parametriVisibili';
import { passwordCorretta } from '@/lib/supabase/verificaPassword';

export type EsitoValoriParametri = { ok: true; parametri: Parametro[] } | { ok: false; messaggio: string };

const MESSAGGIO_GENERICO = 'Password non corretta.';

// Tentativi di verifica per utente (id), in memoria: vedi i limiti in
// lib/limiteTentativi.ts. Raggiungibile solo da utenti già admin.
const tentativi = new Map<string, StatoTentativi>();

// specs/62 - parametri-di-funzionamento.md, sezione "Variabili d'ambiente":
// restituisce i valori dei parametri della lista (lib/parametriVisibili.ts)
// solo se l'admin ha reinserito la propria password. L'email è quella della
// sessione, mai presa dal browser. Niente log: né della password né dei valori.
export async function rivelaValoriParametri(formData: FormData): Promise<EsitoValoriParametri> {
  const { user } = await requireAdmin();
  const password = formData.get('password');
  if (typeof password !== 'string' || password === '') {
    return { ok: false, messaggio: 'Inserisci la tua password.' };
  }
  if (!user.email) return { ok: false, messaggio: MESSAGGIO_GENERICO };

  // Controllo e registrazione del tentativo senza `await` in mezzo: anche
  // richieste in parallelo vengono contate tutte.
  const minuti = minutiBloccoRimanenti(tentativi.get(user.id), Date.now());
  if (minuti > 0) return { ok: false, messaggio: messaggioBlocco(minuti) };
  tentativi.set(user.id, registraTentativo(tentativi.get(user.id), Date.now()));

  if (!(await passwordCorretta(user.email, password, user.id))) {
    return { ok: false, messaggio: MESSAGGIO_GENERICO };
  }

  tentativi.delete(user.id);
  return { ok: true, parametri: valoriParametriPresenti(PARAMETRI_VISIBILI, process.env) };
}
