import { NextResponse } from 'next/server';
import { autorizzaCron } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { inviaEmail, destinatarioNotifiche } from '@/lib/email';
import { oggi, formattaDataItaliana, formattaIntervalloItaliano, formattaMeseItaliano } from '@/lib/date';
import {
  calcolaRetteNonComunicate,
  chiaveAllarmeRette,
  htmlAllarmeRetteNonComunicate,
} from '@/lib/allarmeRette';
import { chiusuraPerData, isGiornoChiuso } from '@/lib/calendarioScolastico';
import {
  dopoOrarioAllarmePresenzePasti,
  allarmeAsiloAttivo,
  calcolaStatoOperativoGiorno,
  descrizioneStatoOperativo,
  htmlAllarmeSettimanaOreNonConfermata,
  settimanaDiRiferimentoOre,
  utentiConSettimanaNonConfermata,
} from '@/lib/allarmi';

export const dynamic = 'force-dynamic';

// Vercel Cron chiama questa route una volta al giorno dopo le 10:00
// Europe/Rome (vedi vercel.json: "30 11 * * *" UTC, che cade sempre
// dopo le 10:00 Rome sia in ora solare sia legale — specs/07 -
// allarmi.md). Protetta dallo stesso secret degli altri cron
// (Authorization: Bearer $CRON_SECRET).
export async function GET(request: Request) {
  if (!autorizzaCron(request)) {
    return NextResponse.json({ errore: 'non autorizzato' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const adesso = new Date();
  const dataOggi = oggi();

  const risultati = {
    mezzogiorno: 'non_applicabile' as 'non_applicabile' | 'inviato' | 'gia_inviato',
    settimanaOre: [] as string[],
    retteNonComunicate: 'non_applicabile' as 'non_applicabile' | 'inviato' | 'gia_inviato' | 'errore_registro',
  };

  // Allarme 1: presenze/pasti non completati entro le 10:00 (specs/07),
  // aggregato sull'intero asilo. Il vincolo "giorno attivo" è lo stesso
  // di presenze/pasti (specs/53); una volta appurato, lo stato operativo
  // richiede la service_role key per vedere tutte le sezioni (non solo
  // quelle di un singolo utente).
  const chiusuraOggi = await chiusuraPerData(supabase, dataOggi);
  const giornoAttivo = !isGiornoChiuso(dataOggi, chiusuraOggi ? [chiusuraOggi] : []);
  if (giornoAttivo && dopoOrarioAllarmePresenzePasti(adesso)) {
    const stato = await calcolaStatoOperativoGiorno(supabase, dataOggi);
    if (allarmeAsiloAttivo(adesso, giornoAttivo, stato)) {
      const { data: giaInviato } = await supabase
        .from('allarmi_inviati')
        .select('id')
        .eq('tipo', 'presenze_pasti_mezzogiorno')
        .eq('chiave', dataOggi)
        .maybeSingle();

      if (giaInviato) {
        risultati.mezzogiorno = 'gia_inviato';
      } else {
        await inviaEmail({
          a: destinatarioNotifiche(),
          oggetto: `Allarme: presenze/pasti non completati — ${formattaDataItaliana(dataOggi)}`,
          html: `<p>Alle ore attuali di ${formattaDataItaliana(dataOggi)}, ${descrizioneStatoOperativo(stato)}. Verifica appena possibile.</p>`,
        });
        await supabase.from('allarmi_inviati').insert({ tipo: 'presenze_pasti_mezzogiorno', chiave: dataOggi });
        risultati.mezzogiorno = 'inviato';
      }
    }
  }

  // Allarme 2: settimana di ore di lavoro non confermata (specs/07),
  // un'email per ogni utente abilitato che non ha confermato la
  // settimana di riferimento (quella precedente fino a venerdì 18:00,
  // poi quella corrente).
  const { inizio: settimanaInizio, fine: settimanaFine } = settimanaDiRiferimentoOre(adesso, dataOggi);
  const utenti = await utentiConSettimanaNonConfermata(supabase, settimanaInizio);

  for (const utente of utenti) {
    const chiave = `${utente.utenteId}_${settimanaInizio}`;
    const { data: giaInviato } = await supabase
      .from('allarmi_inviati')
      .select('id')
      .eq('tipo', 'settimana_ore_non_confermata')
      .eq('chiave', chiave)
      .maybeSingle();
    if (giaInviato) continue;

    await inviaEmail({
      a: destinatarioNotifiche(),
      oggetto: `Allarme: settimana ore non confermata — ${utente.nome} ${utente.cognome}`,
      html: htmlAllarmeSettimanaOreNonConfermata(utente, formattaIntervalloItaliano(settimanaInizio, settimanaFine)),
    });
    await supabase.from('allarmi_inviati').insert({ tipo: 'settimana_ore_non_confermata', chiave });
    risultati.settimanaOre.push(utente.email);
  }

  // Allarme 3: comunicazioni delle rette non inviate (specs/07, specs/56),
  // dal giorno 3 del mese: una sola email per mese (chiave "YYYY-MM").
  // A differenza dei due allarmi sopra, qui si registra in `allarmi_inviati`
  // PRIMA di inviare: l'unicità (tipo, chiave) prenota l'invio, e se il
  // registro rifiuta la riga (es. migration 0061 non ancora applicata, o
  // un altro giro del cron l'ha già presa) l'email non parte, così non può
  // ripartire ogni giorno. Se l'invio fallisce la riga viene cancellata
  // e un tentativo successivo può ritentare.
  const mancanti = await calcolaRetteNonComunicate(supabase, dataOggi);
  if (mancanti.length > 0) {
    const chiave = chiaveAllarmeRette(dataOggi);
    const { error: erroreRegistro } = await supabase
      .from('allarmi_inviati')
      .insert({ tipo: 'rette_non_comunicate', chiave });

    if (erroreRegistro) {
      // 23505 = unique_violation: già inviata questo mese.
      risultati.retteNonComunicate = erroreRegistro.code === '23505' ? 'gia_inviato' : 'errore_registro';
      if (risultati.retteNonComunicate === 'errore_registro') {
        console.error(`Allarme rette non comunicate: registro rifiutato, email non inviata (${erroreRegistro.code})`);
      }
    } else {
      try {
        await inviaEmail({
          a: destinatarioNotifiche(),
          oggetto: `Allarme: comunicazioni rette non inviate — ${formattaMeseItaliano(chiave)}`,
          html: htmlAllarmeRetteNonComunicate(chiave, mancanti),
        });
      } catch (errore) {
        await supabase.from('allarmi_inviati').delete().eq('tipo', 'rette_non_comunicate').eq('chiave', chiave);
        throw errore;
      }
      risultati.retteNonComunicate = 'inviato';
    }
  }

  return NextResponse.json({ ok: true, data: dataOggi, risultati });
}
