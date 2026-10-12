import type { SupabaseClient } from '@supabase/supabase-js';
import type { EsitoLavoroCron, OpzioniLavoroCron } from '@/lib/cronEsecuzioniDati';
import { problemaRiepilogoAllarmi } from '@/lib/cronEsecuzioni';
import { inviaEmail, destinatarioNotifiche } from '@/lib/email';
import { oggi, formattaIntervalloItaliano } from '@/lib/date';
import { calcolaRetteNonComunicate } from '@/lib/allarmeRette';
import { chiusuraPerData, isGiornoChiuso } from '@/lib/calendarioScolastico';
import {
  dopoOrarioAllarmePresenzePasti,
  calcolaStatoOperativoGiorno,
  settimanaDiRiferimentoOre,
  utentiConSettimanaNonConfermata,
} from '@/lib/allarmi';
import {
  costruisciControlliRiepilogo,
  htmlRiepilogoAllarmi,
  oggettoRiepilogoAllarmi,
  riepilogoDaSistemare,
  type InputRiepilogo,
} from '@/lib/riepilogoAllarmi';

// Lavoro del job "Riepilogo allarmi" (specs/07 - allarmi.md), condiviso dalla
// route pianificata app/api/cron/allarmi/route.ts (Vercel Cron, protetta da
// CRON_SECRET) e dal lancio a mano dell'admin (app/admin/cron-job/actions.ts,
// specs/63 "Lancio a mano"). Il client arriva da chi chiama: la service_role,
// perché i controlli guardano tutte le sezioni.
//
// Valuta tutti i controlli (appello, pasti a Rojac, rette ai genitori, ore di
// lavoro) e invia UN'email di riepilogo, che li riporta sempre tutti con ora
// e stato, se almeno uno è da sistemare.

// Valore di `allarmi_inviati.tipo` che oggi significa "email di riepilogo
// giornaliera inviata" (chiave = data). È il valore storico
// dell'allarme presenze/pasti, già ammesso dal vincolo CHECK: riusarlo
// evita una migration (specs/07, Regole, idempotenza).
const TIPO_RIEPILOGO_GIORNALIERO = 'presenze_pasti_mezzogiorno';

export type RispostaRiepilogoAllarmi = {
  ok: true;
  data: string;
  riepilogo: 'tutto_ok' | 'inviato' | 'gia_inviato' | 'errore_registro';
  controlli: Record<string, string>;
};

// grant-check: service_role
export async function lavoroRiepilogoAllarmi(
  supabase: SupabaseClient,
  { estemporaneo }: OpzioniLavoroCron
): Promise<EsitoLavoroCron<RispostaRiepilogoAllarmi>> {
  const adesso = new Date();
  const dataOggi = oggi();

  // Controlli di giornata: solo dopo le 10:00 in un giorno di apertura
  // (specs/53); richiedono la service_role key per vedere tutte le
  // sezioni (non solo quelle di un singolo utente).
  const chiusuraOggi = await chiusuraPerData(supabase, dataOggi);
  const giornoAttivo = !isGiornoChiuso(dataOggi, chiusuraOggi ? [chiusuraOggi] : []);
  const dopoOrario = dopoOrarioAllarmePresenzePasti(adesso);
  let giornata: InputRiepilogo['giornata'] = null;
  if (giornoAttivo && dopoOrario) {
    const stato = await calcolaStatoOperativoGiorno(supabase, dataOggi);
    giornata = { ora: new Date(), stato };
  }

  // Rette ai genitori (specs/07, specs/56): l'elenco è vuoto prima del
  // giorno 3 e nei mesi interamente chiusi.
  const mancanti = await calcolaRetteNonComunicate(supabase, dataOggi);
  const rette = { ora: new Date(), mancanti };

  // Ore di lavoro: settimana di riferimento (la precedente fino a venerdì
  // 18:00, poi la corrente).
  const { inizio: settimanaInizio, fine: settimanaFine } = settimanaDiRiferimentoOre(adesso, dataOggi);
  const utenti = await utentiConSettimanaNonConfermata(supabase, settimanaInizio);
  const ore = {
    ora: new Date(),
    intervallo: formattaIntervalloItaliano(settimanaInizio, settimanaFine),
    utenti,
  };

  const controlli = costruisciControlliRiepilogo({
    oggi: dataOggi,
    giornoAttivo,
    dopoOrario,
    oraRiepilogo: new Date(),
    giornata,
    rette,
    ore,
  });
  const stati = Object.fromEntries(controlli.map((c) => [c.id, c.stato]));
  const risposta = (riepilogo: RispostaRiepilogoAllarmi['riepilogo']): RispostaRiepilogoAllarmi => ({
    ok: true,
    data: dataOggi,
    riepilogo,
    controlli: stati,
  });

  if (!riepilogoDaSistemare(controlli)) {
    return { dati: risposta('tutto_ok') };
  }

  const email = {
    a: destinatarioNotifiche(),
    oggetto: oggettoRiepilogoAllarmi(controlli, dataOggi),
    html: htmlRiepilogoAllarmi(controlli, dataOggi),
  };

  // Lancio a mano (specs/63): invia sempre, senza leggere né scrivere
  // `allarmi_inviati`, così il lancio pianificato del giorno parte comunque.
  if (estemporaneo) {
    await inviaEmail(email);
    return { dati: risposta('inviato') };
  }

  // Si registra in `allarmi_inviati` PRIMA di inviare: l'unicità
  // (tipo, chiave) prenota l'invio, e se il registro rifiuta la riga
  // l'email non parte, così non può ripartire a ogni giro del cron. Se
  // l'invio fallisce la riga viene cancellata e un tentativo successivo
  // può ritentare (stesso principio di specs/52).
  const { error: erroreRegistro } = await supabase
    .from('allarmi_inviati')
    .insert({ tipo: TIPO_RIEPILOGO_GIORNALIERO, chiave: dataOggi });

  if (erroreRegistro) {
    // 23505 = unique_violation: già inviata oggi.
    const riepilogo = erroreRegistro.code === '23505' ? 'gia_inviato' : 'errore_registro';
    if (riepilogo === 'errore_registro') {
      console.error(`Riepilogo allarmi: registro rifiutato, email non inviata (${erroreRegistro.code})`);
    }
    return { dati: risposta(riepilogo), problema: problemaRiepilogoAllarmi(riepilogo) };
  }

  try {
    await inviaEmail(email);
  } catch (errore) {
    await supabase.from('allarmi_inviati').delete().eq('tipo', TIPO_RIEPILOGO_GIORNALIERO).eq('chiave', dataOggi);
    throw errore;
  }

  return { dati: risposta('inviato') };
}
