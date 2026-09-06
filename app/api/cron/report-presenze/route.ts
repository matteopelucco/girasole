import { NextResponse } from 'next/server';
import { autorizzaCron } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { inviaEmail, destinatarioNotifiche, type AllegatoEmail } from '@/lib/email';
import {
  generaTabellaGiornalieraHtml,
  aggregaReportPeriodoTutteLeClassi,
  recuperaComunicazioniPastiPeriodo,
  type SezioneConRighe,
} from '@/lib/reportPresenze';
import { generaPdfTabellare, type SezionePdf, type ComunicazionePastiPdf } from '@/lib/pdfReport';
import { rigaComunicazione, totalePasti, type ComunicazionePasto } from '@/lib/comunicazionePasti';
import type { RigaReportBambino } from '@/lib/report';
import { generaRiepilogoOreLavoroSettimanaHtml, personePdfOreLavoroMensile } from '@/lib/reportOreLavoro';
import { generaPdfOreLavoroMensile } from '@/lib/pdfOreLavoro';
import {
  oggi,
  sommaGiorni,
  formattaDataItaliana,
  formattaIntervalloItaliano,
  formattaMeseItaliano,
  lunediSettimana,
  meseDaData,
  primoGiornoMese,
  isUltimoGiornoSettimana,
  isUltimoGiornoMese,
} from '@/lib/date';

export const dynamic = 'force-dynamic';

type TipoReportNotturno = 'giornaliero' | 'settimanale' | 'mensile';

// specs/52 - report-email-automatico.md: 'sempre' (default) ricalcola e
// invia settimanale/mensile ogni notte "a tutt'oggi"; 'fine_periodo' li
// invia solo l'ultima notte della settimana/del mese.
function modalitaPeriodici(): 'sempre' | 'fine_periodo' {
  return process.env.REPORT_EMAIL_MODALITA_PERIODICI === 'fine_periodo' ? 'fine_periodo' : 'sempre';
}

// Il PDF usa un font standard (Helvetica, codifica WinAnsi/Latin-1): un
// simbolo emoji come "⚠" non è codificabile, quindi il warning va in
// testo semplice, non nella stessa forma usata su schermo/email HTML
// (specs/06 - controllo-consistenza.md).
function righeInCelle(righe: RigaReportBambino[]): string[][] {
  return righe.map((r) => [
    `${r.nome} ${r.cognome}${r.inconsistenze.length ? ' [!] INCONSISTENZA' : ''}`,
    String(r.presenze),
    String(r.preAsilo),
    String(r.postAsilo),
    String(r.pasti),
  ]);
}

function sezioniPdf(sezioniDati: SezioneConRighe[], intestazioni: string[]): SezionePdf[] {
  return sezioniDati.map((s) => ({ nome: s.nome, intestazioni, righe: righeInCelle(s.righe) }));
}

// Blocco "Comunicazione pasti" per il PDF (specs/16 -
// comunicazione-pasti-rojac.md): un'unica sezione per l'intero
// documento (la comunicazione è per l'intero asilo, non per classe) —
// condiviso tra giornaliero e periodico per non duplicare questa
// logica in due punti (CLAUDE.md, jscpd).
function comunicazionePastiPdf(comunicazioni: ComunicazionePasto[]): ComunicazionePastiPdf | undefined {
  if (!comunicazioni.length) return undefined;
  return {
    righe: comunicazioni.map(rigaComunicazione),
    totale: `Totale del periodo: ${totalePasti(comunicazioni)} pasti`,
  };
}

async function allegatoPeriodico(
  tipo: 'settimanale' | 'mensile',
  inizio: string,
  fine: string,
  titolo: string,
  sottotitolo: string
): Promise<AllegatoEmail> {
  const [sezioniDati, comunicazioni] = await Promise.all([
    aggregaReportPeriodoTutteLeClassi(inizio, fine),
    recuperaComunicazioniPastiPeriodo(inizio, fine),
  ]);
  const pdf = await generaPdfTabellare(
    titolo,
    sottotitolo,
    sezioniPdf(sezioniDati, ['Bambino', 'Presenze', 'Pre-asilo', 'Post-asilo', 'Pasti']),
    comunicazionePastiPdf(comunicazioni)
  );
  return { filename: `report-${tipo}-${fine}.pdf`, content: pdf };
}

async function allegatoGiornaliero(data: string): Promise<AllegatoEmail> {
  const [sezioniDati, comunicazioni] = await Promise.all([
    aggregaReportPeriodoTutteLeClassi(data, data),
    recuperaComunicazioniPastiPeriodo(data, data),
  ]);
  const pdf = await generaPdfTabellare(
    'Report giornaliero',
    formattaDataItaliana(data),
    sezioniPdf(sezioniDati, ['Bambino', 'Presente', 'Pre-asilo', 'Post-asilo', 'Pasto']),
    comunicazionePastiPdf(comunicazioni)
  );
  return { filename: `report-giornaliero-${data}.pdf`, content: pdf };
}

// PDF mensile delle ore di lavoro del personale (specs/52, scenario
// "PDF mensile delle ore del personale in allegato"; specs/19 -
// monte-ore.md): allegato insieme al report mensile di presenze/pasti,
// stessa idempotenza (nessun tracciamento separato — vedi Regole).
async function allegatoOreLavoroMensile(mese: string): Promise<AllegatoEmail> {
  const persone = await personePdfOreLavoroMensile(mese);
  const pdf = await generaPdfOreLavoroMensile(formattaMeseItaliano(mese), persone);
  return { filename: `ore-lavoro-${mese}.pdf`, content: pdf };
}

// Vercel Cron chiama questa route una volta al giorno poco dopo la
// mezzanotte Europe/Rome (vedi vercel.json: "0 23 * * *" UTC, che cade
// sempre a/dopo mezzanotte Rome sia in ora solare che legale — specs/52
// - report-email-automatico.md). Protetta dal secret che Vercel Cron
// invia in automatico in Authorization: Bearer $CRON_SECRET quando la
// variabile d'ambiente CRON_SECRET è configurata sul progetto.
export async function GET(request: Request) {
  if (!autorizzaCron(request)) {
    return NextResponse.json({ errore: 'non autorizzato' }, { status: 401 });
  }

  // Il cron gira poco dopo la mezzanotte Rome: oggi() è già il nuovo
  // giorno, quindi il giorno da riepilogare è quello appena concluso.
  const dataReport = sommaGiorni(oggi(), -1);
  const supabase = createAdminClient();

  const risultati: Record<TipoReportNotturno, 'inviato' | 'gia_inviato' | 'saltato'> = {
    giornaliero: 'saltato',
    settimanale: 'saltato',
    mensile: 'saltato',
  };

  // Ogni voce genera uno o più allegati per lo stesso tipo di report:
  // il mensile ne genera due (presenze/pasti + ore di lavoro, specs/52),
  // gli altri uno solo — un array uniforme evita un caso speciale nel
  // punto di invio sotto.
  const daPreparare: { tipo: TipoReportNotturno; genera: () => Promise<AllegatoEmail[]> }[] = [];

  const { data: giornalieroInviato } = await supabase
    .from('report_giornalieri_inviati')
    .select('data')
    .eq('data', dataReport)
    .maybeSingle();
  if (giornalieroInviato) {
    risultati.giornaliero = 'gia_inviato';
  } else {
    daPreparare.push({ tipo: 'giornaliero', genera: async () => [await allegatoGiornaliero(dataReport)] });
  }

  const modalita = modalitaPeriodici();

  if (modalita === 'sempre' || isUltimoGiornoSettimana(dataReport)) {
    const { data: settimanaleInviato } = await supabase
      .from('report_periodici_inviati')
      .select('data')
      .eq('tipo', 'settimanale')
      .eq('data', dataReport)
      .maybeSingle();
    if (settimanaleInviato) {
      risultati.settimanale = 'gia_inviato';
    } else {
      const inizio = lunediSettimana(dataReport);
      daPreparare.push({
        tipo: 'settimanale',
        genera: async () => [
          await allegatoPeriodico(
            'settimanale',
            inizio,
            dataReport,
            'Report settimanale',
            formattaIntervalloItaliano(inizio, dataReport)
          ),
        ],
      });
    }
  }

  if (modalita === 'sempre' || isUltimoGiornoMese(dataReport)) {
    const { data: mensileInviato } = await supabase
      .from('report_periodici_inviati')
      .select('data')
      .eq('tipo', 'mensile')
      .eq('data', dataReport)
      .maybeSingle();
    if (mensileInviato) {
      risultati.mensile = 'gia_inviato';
    } else {
      const mese = meseDaData(dataReport);
      const inizio = primoGiornoMese(mese);
      daPreparare.push({
        tipo: 'mensile',
        genera: async () => [
          await allegatoPeriodico('mensile', inizio, dataReport, 'Report mensile', formattaMeseItaliano(mese)),
          await allegatoOreLavoroMensile(mese),
        ],
      });
    }
  }

  if (daPreparare.length) {
    const allegati = (await Promise.all(daPreparare.map((d) => d.genera()))).flat();
    // Il riepilogo ore di lavoro (specs/52, specs/19) è parte del corpo
    // "dettagliato" giornaliero, non un allegato a parte: compare solo
    // quando quel corpo viene davvero (ri)generato, stessa condizione
    // della tabella di presenze/pasti sopra.
    const htmlGiornaliero = daPreparare.some((d) => d.tipo === 'giornaliero')
      ? (await generaTabellaGiornalieraHtml(dataReport)) + (await generaRiepilogoOreLavoroSettimanaHtml(dataReport))
      : `<p>In allegato: ${daPreparare.map((d) => d.tipo).join(', ')}.</p>`;

    await inviaEmail({
      a: destinatarioNotifiche(),
      oggetto: `Report del ${formattaDataItaliana(dataReport)}`,
      html: htmlGiornaliero,
      allegati,
    });

    for (const d of daPreparare) {
      if (d.tipo === 'giornaliero') {
        await supabase.from('report_giornalieri_inviati').insert({ data: dataReport });
      } else {
        await supabase.from('report_periodici_inviati').insert({ tipo: d.tipo, data: dataReport });
      }
      risultati[d.tipo] = 'inviato';
    }
  }

  return NextResponse.json({ ok: true, data: dataReport, risultati });
}
