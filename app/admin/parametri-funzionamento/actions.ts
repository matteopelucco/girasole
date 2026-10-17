'use server';

import { revalidatePath } from 'next/cache';
import type { EsitoAzione } from '@/components/FormConEsito';
import { requireAdmin } from '@/lib/auth';
import { validaIndirizzoIcal } from '@/lib/calendarioIcal';
import { indirizzoCalendario, salvaIndirizzoCalendario } from '@/lib/calendarioImpostazioniDati';
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
export type EsitoIndirizzoCalendario = { ok: true; indirizzo: string } | { ok: false; messaggio: string };

const MESSAGGIO_GENERICO = 'Password non corretta.';

// Tentativi di verifica per utente (id), in memoria: vedi i limiti in
// lib/limiteTentativi.ts. Raggiungibile solo da utenti già admin.
const tentativi = new Map<string, StatoTentativi>();

// Verifica che `password` sia quella dell'admin collegato (specs/62): l'email è
// quella della sessione, mai presa dal browser; controllo e registrazione del
// tentativo senza `await` in mezzo, così anche richieste in parallelo vengono
// contate tutte. Errore sempre generico. Niente log: né della password né dei
// valori che sblocca.
async function verificaPasswordAdmin(
  user: { id: string; email?: string | null },
  password: FormDataEntryValue | null
): Promise<{ ok: true } | { ok: false; messaggio: string }> {
  if (typeof password !== 'string' || password === '') {
    return { ok: false, messaggio: 'Inserisci la tua password.' };
  }
  if (!user.email) return { ok: false, messaggio: MESSAGGIO_GENERICO };

  const minuti = minutiBloccoRimanenti(tentativi.get(user.id), Date.now());
  if (minuti > 0) return { ok: false, messaggio: messaggioBlocco(minuti) };
  tentativi.set(user.id, registraTentativo(tentativi.get(user.id), Date.now()));

  if (!(await passwordCorretta(user.email, password, user.id))) {
    return { ok: false, messaggio: MESSAGGIO_GENERICO };
  }
  tentativi.delete(user.id);
  return { ok: true };
}

// specs/62 - parametri-di-funzionamento.md, sezione "Variabili d'ambiente":
// restituisce i valori dei parametri della lista (lib/parametriVisibili.ts)
// solo se l'admin ha reinserito la propria password. L'email è quella della
// sessione, mai presa dal browser. Niente log: né della password né dei valori.
export async function rivelaValoriParametri(formData: FormData): Promise<EsitoValoriParametri> {
  const { user } = await requireAdmin();
  const verifica = await verificaPasswordAdmin(user, formData.get('password'));
  if (!verifica.ok) return verifica;
  return { ok: true, parametri: valoriParametriPresenti(PARAMETRI_VISIBILI, process.env) };
}

// specs/64 - calendario-eventi.md: l'indirizzo iCal si vede solo dopo aver
// reinserito la password (stessa verifica e stesso limite di tentativi dei
// valori delle variabili d'ambiente). Niente log né dettagli degli errori.
export async function rivelaIndirizzoCalendario(formData: FormData): Promise<EsitoIndirizzoCalendario> {
  const { supabase, user } = await requireAdmin();
  const verifica = await verificaPasswordAdmin(user, formData.get('password'));
  if (!verifica.ok) return verifica;
  const indirizzo = await indirizzoCalendario(supabase);
  if (!indirizzo) return { ok: false, messaggio: 'Nessun indirizzo salvato.' };
  return { ok: true, indirizzo };
}

// specs/64: salva (o svuota) l'indirizzo iCal. L'indirizzo è validato sul
// server (https, host Google, finale .ics): campo vuoto = sincronizzazione
// disattivata. Gli errori non riportano mai l'indirizzo, né quello digitato né
// il dettaglio del database.
export async function aggiornaIndirizzoCalendario(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const grezzo = formData.get('indirizzo');
  const esito = validaIndirizzoIcal(typeof grezzo === 'string' ? grezzo : '', {
    CALENDARIO_ICAL_PROVA_ORIGINE: process.env.CALENDARIO_ICAL_PROVA_ORIGINE,
    VERCEL_ENV: process.env.VERCEL_ENV,
  });
  if (!esito.ok) return { ok: false, messaggio: esito.messaggio };

  if (!(await salvaIndirizzoCalendario(supabase, esito.indirizzo))) {
    return { ok: false, messaggio: "Impossibile salvare l'indirizzo. Riprova." };
  }
  revalidatePath('/admin/parametri-funzionamento');
  return { ok: true };
}
