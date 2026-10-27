import type { SupabaseClient } from '@supabase/supabase-js';
import type { EsitoLavoroCron, OpzioniLavoroCron } from '@/lib/cronEsecuzioniDati';
import { problemaRiepilogoAllarmi } from '@/lib/cronEsecuzioni';
import { inviaEmail, destinatarioNotifiche } from '@/lib/email';
import { oggi, formattaIntervalloItaliano } from '@/lib/date';
import { calcolaRetteNonComunicate } from '@/lib/allarmeRette';
import { calcolaMesiRojacMancanti, mesiRojacDaAvvisare, TIPO_ALLARME_ROJAC } from '@/lib/allarmeRojac';
import { chiusuraPerData, isGiornoChiuso } from '@/lib/calendarioScolastico';
import {
  dopoOrarioAllarmePresenzePasti,
  calcolaStatoOperativoGiorno,
  settimanaDiRiferimentoOre,
  utentiConfermaSettimanaNonRichiesta,
  utentiConSettimanaNonConfermata,
} from '@/lib/allarmi';
import {
  costruisciControlliRiepilogo,
  giornalieroDaInviare,
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
// Valuta tutti i controlli (appello, pasti a Rojac, rette ai genitori, mail
// mensile a Rojac, ore di lavoro) e invia UN'email di riepilogo, che li
// riporta sempre tutti con ora e stato, se almeno uno è da sistemare. La mail
// mensile a Rojac fa partire l'email una sola volta per ogni mese mancante
// (riga in `allarmi_inviati`, tipo `rojac_non_inviata`, chiave = mese).

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
  // Quanti utenti hanno la conferma settimana non richiesta (controllo
  // saltato, dichiarato nel riepilogo, specs/07).
  confermaSettimanaNonRichiesta: number;
  // Mesi ("YYYY-MM") della mail a Rojac segnati come avvisati in questo giro
  // (vuoto nel lancio a mano, che non scrive il registro).
  mesiRojacAvvisati: string[];
};

type Prenotazione = { tipo: string; chiave: string };

// Mesi mancanti per cui il registro dice che l'email è già partita. Se la
// lettura fallisce si considerano tutti da avvisare: la prenotazione che
// segue (unicità tipo+chiave) scarta comunque quelli già avvisati.
// grant-check: service_role
async function mesiRojacGiaAvvisati(supabase: SupabaseClient, mesi: string[]): Promise<string[]> {
  if (!mesi.length) return [];
  const { data, error } = await supabase
    .from('allarmi_inviati')
    .select('chiave')
    .eq('tipo', TIPO_ALLARME_ROJAC)
    .in('chiave', mesi);
  if (error) {
    console.error(`Riepilogo allarmi: lettura mesi Rojac già avvisati non riuscita (${error.code})`);
    return [];
  }
  return (data ?? []).map((r) => r.chiave as string);
}

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
  // Chi ha la conferma settimana non richiesta (specs/03) non si controlla,
  // ma il riepilogo lo dichiara.
  const [utenti, nonRichiesta] = await Promise.all([
    utentiConSettimanaNonConfermata(supabase, settimanaInizio),
    utentiConfermaSettimanaNonRichiesta(supabase),
  ]);
  const ore = {
    ora: new Date(),
    intervallo: formattaIntervalloItaliano(settimanaInizio, settimanaFine),
    utenti,
    nonRichiesta,
  };

  // Mail mensile a Rojac (specs/07): mesi conclusi senza invio registrato e,
  // tra questi, quelli per cui l'email non è ancora partita. Il lancio a mano
  // non legge il registro: li considera tutti da avvisare.
  const mesiRojac = await calcolaMesiRojacMancanti(supabase, dataOggi);
  const mesiGiaAvvisati = estemporaneo ? [] : await mesiRojacGiaAvvisati(supabase, mesiRojac);
  const rojac = {
    ora: new Date(),
    mancanti: mesiRojac,
    daAvvisare: mesiRojacDaAvvisare(mesiRojac, mesiGiaAvvisati),
  };

  const controlli = costruisciControlliRiepilogo({
    oggi: dataOggi,
    giornoAttivo,
    dopoOrario,
    oraRiepilogo: new Date(),
    giornata,
    rette,
    ore,
    rojac,
  });
  const stati = Object.fromEntries(controlli.map((c) => [c.id, c.stato]));
  const risposta = (
    riepilogo: RispostaRiepilogoAllarmi['riepilogo'],
    mesiRojacAvvisati: string[] = []
  ): RispostaRiepilogoAllarmi => ({
    ok: true,
    data: dataOggi,
    riepilogo,
    controlli: stati,
    confermaSettimanaNonRichiesta: nonRichiesta.length,
    mesiRojacAvvisati,
  });

  if (!controlli.some((c) => c.stato === 'da_sistemare')) {
    return { dati: risposta('tutto_ok') };
  }
  // Da sistemare c'è solo la mail a Rojac di mesi già avvisati: niente email.
  if (!riepilogoDaSistemare(controlli)) {
    return { dati: risposta('gia_inviato') };
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
  // (tipo, chiave) prenota l'invio (una riga per la data di oggi, se è da
  // sistemare un controllo diverso dalla mail a Rojac; una riga per ogni mese
  // di Rojac non ancora avvisato). L'email parte se almeno una prenotazione
  // riesce: quelle già presenti (23505) sono invii già fatti. Se il registro
  // rifiuta una riga per un altro motivo quella prenotazione non c'è e, se
  // nessuna è riuscita, l'email non parte: così non può ripartire a ogni giro
  // del cron. Se l'invio fallisce le righe vengono cancellate e un tentativo
  // successivo può ritentare (stesso principio di specs/52).
  const richieste: Prenotazione[] = [
    ...(giornalieroDaInviare(controlli) ? [{ tipo: TIPO_RIEPILOGO_GIORNALIERO, chiave: dataOggi }] : []),
    ...rojac.daAvvisare.map((mese) => ({ tipo: TIPO_ALLARME_ROJAC, chiave: mese })),
  ];
  const prenotate: Prenotazione[] = [];
  let rifiutate = 0;
  for (const richiesta of richieste) {
    const { error } = await supabase.from('allarmi_inviati').insert(richiesta);
    if (!error) {
      prenotate.push(richiesta);
    } else if (error.code !== '23505') {
      // 23505 = unique_violation: già inviata.
      rifiutate += 1;
      console.error(`Riepilogo allarmi: registro rifiutato (${error.code})`);
    }
  }
  const problema = rifiutate > 0 ? problemaRiepilogoAllarmi('errore_registro') : null;

  if (prenotate.length === 0) {
    const riepilogo = rifiutate > 0 ? 'errore_registro' : 'gia_inviato';
    return { dati: risposta(riepilogo), problema };
  }

  try {
    await inviaEmail(email);
  } catch (errore) {
    for (const { tipo, chiave } of prenotate) {
      await supabase.from('allarmi_inviati').delete().eq('tipo', tipo).eq('chiave', chiave);
    }
    throw errore;
  }

  const mesiAvvisati = prenotate.filter((p) => p.tipo === TIPO_ALLARME_ROJAC).map((p) => p.chiave);
  return { dati: risposta('inviato', mesiAvvisati), problema };
}
