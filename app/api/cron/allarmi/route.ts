import { NextResponse } from 'next/server';
import { autorizzaCron } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { inviaEmail, destinatarioNotifiche } from '@/lib/email';
import { oggi, formattaDataItaliana, formattaIntervalloItaliano, settimanaPrecedente } from '@/lib/date';
import { chiusuraPerData, isGiornoChiuso } from '@/lib/calendarioScolastico';
import {
  dopoMezzogiorno,
  allarmeMezzogiornoAttivo,
  calcolaStatoOperativoGiorno,
  descrizioneStatoOperativo,
  utentiConSettimanaNonConfermata,
} from '@/lib/allarmi';

export const dynamic = 'force-dynamic';

// Vercel Cron chiama questa route una volta al giorno dopo mezzogiorno
// Europe/Rome (vedi vercel.json: "30 11 * * *" UTC, che cade sempre
// dopo le 12:00 Rome sia in ora solare sia legale — specs/07 -
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
  };

  // Allarme 1: presenze/pasti non completati entro mezzogiorno
  // (specs/07). Il vincolo "giorno attivo" è lo stesso di presenze/pasti
  // (specs/53); una volta appurato, lo stato operativo richiede la
  // service_role key per vedere tutte le sezioni (non solo quelle di un
  // singolo utente).
  const chiusuraOggi = await chiusuraPerData(supabase, dataOggi);
  const giornoAttivo = !isGiornoChiuso(dataOggi, chiusuraOggi ? [chiusuraOggi] : []);
  if (giornoAttivo && dopoMezzogiorno(adesso)) {
    const stato = await calcolaStatoOperativoGiorno(supabase, dataOggi);
    if (allarmeMezzogiornoAttivo(adesso, giornoAttivo, stato)) {
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
  // settimana appena conclusa.
  const { inizio: settimanaInizio, fine: settimanaFine } = settimanaPrecedente(dataOggi);
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
      html: `<p>${utente.nome} ${utente.cognome} (${utente.email}) non ha ancora confermato le ore della settimana ${formattaIntervalloItaliano(settimanaInizio, settimanaFine)}.</p>`,
    });
    await supabase.from('allarmi_inviati').insert({ tipo: 'settimana_ore_non_confermata', chiave });
    risultati.settimanaOre.push(utente.email);
  }

  return NextResponse.json({ ok: true, data: dataOggi, risultati });
}
