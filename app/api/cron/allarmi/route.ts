import { NextResponse } from 'next/server';
import { autorizzaCron } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
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

export const dynamic = 'force-dynamic';

// Valore di `allarmi_inviati.tipo` che oggi significa "email di riepilogo
// giornaliera inviata" (chiave = data). È il valore storico
// dell'allarme presenze/pasti, già ammesso dal vincolo CHECK: riusarlo
// evita una migration (specs/07, Regole, idempotenza).
const TIPO_RIEPILOGO_GIORNALIERO = 'presenze_pasti_mezzogiorno';

// Vercel Cron chiama questa route una volta al giorno dopo le 10:00
// Europe/Rome (vedi vercel.json: "30 11 * * *" UTC, che cade sempre
// dopo le 10:00 Rome sia in ora solare sia legale — specs/07 -
// allarmi.md). Protetta dallo stesso secret degli altri cron
// (Authorization: Bearer $CRON_SECRET).
//
// Valuta tutti i controlli (appello, pasti a Rojac, rette ai genitori,
// ore di lavoro) e invia UN'email di riepilogo, che li riporta sempre
// tutti con ora e stato, se almeno uno è da sistemare.
export async function GET(request: Request) {
  if (!autorizzaCron(request)) {
    return NextResponse.json({ errore: 'non autorizzato' }, { status: 401 });
  }

  const supabase = createAdminClient();
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

  if (!riepilogoDaSistemare(controlli)) {
    return NextResponse.json({ ok: true, data: dataOggi, riepilogo: 'tutto_ok', controlli: stati });
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
    return NextResponse.json({ ok: true, data: dataOggi, riepilogo, controlli: stati });
  }

  try {
    await inviaEmail({
      a: destinatarioNotifiche(),
      oggetto: oggettoRiepilogoAllarmi(controlli, dataOggi),
      html: htmlRiepilogoAllarmi(controlli, dataOggi),
    });
  } catch (errore) {
    await supabase.from('allarmi_inviati').delete().eq('tipo', TIPO_RIEPILOGO_GIORNALIERO).eq('chiave', dataOggi);
    throw errore;
  }

  return NextResponse.json({ ok: true, data: dataOggi, riepilogo: 'inviato', controlli: stati });
}
