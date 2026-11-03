'use server';

import { revalidatePath } from 'next/cache';
import type { EsitoAzione } from '@/components/FormConEsito';
import type { StatoImporti } from '@/components/FormImporti';
import { requireAdmin } from '@/lib/auth';
import { validaIndirizzoIcal } from '@/lib/calendarioIcal';
import { indirizzoCalendario, salvaIndirizzoCalendario } from '@/lib/calendarioImpostazioniDati';
import { CAMPI_PREZZI, MESSAGGIO_CONCORRENZA, parseImporto, type Prezzi } from '@/lib/prezzi';
import { salvaPrezzi } from '@/lib/prezziDati';
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
    VERCEL: process.env.VERCEL,
  });
  if (!esito.ok) return { ok: false, messaggio: esito.messaggio };

  if (!(await salvaIndirizzoCalendario(supabase, esito.indirizzo))) {
    return { ok: false, messaggio: "Impossibile salvare l'indirizzo. Riprova." };
  }
  revalidatePath('/admin/parametri-funzionamento');
  return { ok: true };
}

// specs/62, sezione "Prezzi" (PRZ-03, PRZ-04, PRZ-05, PRZ-09): salva gli otto
// prezzi tutti insieme o nessuno. Ogni valore passa da `parseImporto`: uno non
// valido (vuoto, testo, negativo, più di due decimali, notazione scientifica,
// migliaia, sopra 9999,99) è rifiutato con un messaggio sul suo campo e non si
// scrive nulla; mai arrotondato, mai trasformato in 0. Il salvataggio parte dai
// dati letti dal form: se un altro admin ha salvato nel frattempo, viene
// rifiutato (controllo con `updated_at`). Niente nei log.
export async function aggiornaPrezzi(_stato: StatoImporti, formData: FormData): Promise<StatoImporti> {
  const { supabase } = await requireAdmin();

  const prezzi = {} as Prezzi;
  const errori: Record<string, string> = {};
  for (const { colonna } of CAMPI_PREZZI) {
    const grezzo = formData.get(colonna);
    const esito = parseImporto(typeof grezzo === 'string' ? grezzo : '');
    if (esito.ok) prezzi[colonna] = esito.valore;
    else errori[colonna] = esito.errore;
  }
  if (Object.keys(errori).length > 0) return { esito: 'errore', errori };

  const aggiornatoIl = formData.get('aggiornato_il');
  if (typeof aggiornatoIl !== 'string' || aggiornatoIl === '') {
    return { esito: 'errore', messaggio: MESSAGGIO_CONCORRENZA };
  }

  const esito = await salvaPrezzi(supabase, prezzi, aggiornatoIl);
  if (esito === 'concorrenza') return { esito: 'errore', messaggio: MESSAGGIO_CONCORRENZA };
  if (esito === 'errore') return { esito: 'errore', messaggio: 'Impossibile salvare i prezzi. Riprova.' };

  revalidatePath('/admin/parametri-funzionamento');
  return { esito: 'salvato' };
}
