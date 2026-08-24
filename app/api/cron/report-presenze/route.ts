import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { inviaEmail, type AllegatoEmail } from '@/lib/email';
import { generaSchedaGiornalieraHtml, aggregaReportPeriodoTutteLeClassi } from '@/lib/reportPresenze';
import { generaPdfTabellare, type SezionePdf } from '@/lib/pdfReport';
import type { RigaReportBambino } from '@/lib/report';
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

const DESTINATARIO_DEFAULT = 'info@asilosartorio.it';

export const dynamic = 'force-dynamic';

type TipoReportNotturno = 'giornaliero' | 'settimanale' | 'mensile';

function destinatarioReport(): string {
  return process.env.REPORT_EMAIL_DESTINATARIO || DESTINATARIO_DEFAULT;
}

// specs/52 - report-email-automatico.md: 'sempre' (default) ricalcola e
// invia settimanale/mensile ogni notte "a tutt'oggi"; 'fine_periodo' li
// invia solo l'ultima notte della settimana/del mese.
function modalitaPeriodici(): 'sempre' | 'fine_periodo' {
  return process.env.REPORT_EMAIL_MODALITA_PERIODICI === 'fine_periodo' ? 'fine_periodo' : 'sempre';
}

function righeInCelle(righe: RigaReportBambino[]): string[][] {
  return righe.map((r) => [
    `${r.nome} ${r.cognome}`,
    String(r.presenze),
    String(r.preAsilo),
    String(r.postAsilo),
    String(r.pasti),
  ]);
}

async function allegatoPeriodico(
  tipo: 'settimanale' | 'mensile',
  inizio: string,
  fine: string,
  titolo: string,
  sottotitolo: string
): Promise<AllegatoEmail> {
  const sezioniDati = await aggregaReportPeriodoTutteLeClassi(inizio, fine);
  const sezioniPdf: SezionePdf[] = sezioniDati.map((s) => ({
    nome: s.nome,
    intestazioni: ['Bambino', 'Presenze', 'Pre-asilo', 'Post-asilo', 'Pasti'],
    righe: righeInCelle(s.righe),
  }));
  const pdf = await generaPdfTabellare(titolo, sottotitolo, sezioniPdf);
  return { filename: `report-${tipo}-${fine}.pdf`, content: pdf };
}

async function allegatoGiornaliero(data: string): Promise<AllegatoEmail> {
  const sezioniDati = await aggregaReportPeriodoTutteLeClassi(data, data);
  const sezioniPdf: SezionePdf[] = sezioniDati.map((s) => ({
    nome: s.nome,
    intestazioni: ['Bambino', 'Presente', 'Pre-asilo', 'Post-asilo', 'Pasto'],
    righe: righeInCelle(s.righe),
  }));
  const pdf = await generaPdfTabellare('Report giornaliero', formattaDataItaliana(data), sezioniPdf);
  return { filename: `report-giornaliero-${data}.pdf`, content: pdf };
}

// Vercel Cron chiama questa route una volta al giorno poco dopo la
// mezzanotte Europe/Rome (vedi vercel.json: "0 23 * * *" UTC, che cade
// sempre a/dopo mezzanotte Rome sia in ora solare che legale — specs/52
// - report-email-automatico.md). Protetta dal secret che Vercel Cron
// invia in automatico in Authorization: Bearer $CRON_SECRET quando la
// variabile d'ambiente CRON_SECRET è configurata sul progetto.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ errore: 'non autorizzato' }, { status: 401 });
    }
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

  const daPreparare: { tipo: TipoReportNotturno; genera: () => Promise<AllegatoEmail> }[] = [];

  const { data: giornalieroInviato } = await supabase
    .from('report_giornalieri_inviati')
    .select('data')
    .eq('data', dataReport)
    .maybeSingle();
  if (giornalieroInviato) {
    risultati.giornaliero = 'gia_inviato';
  } else {
    daPreparare.push({ tipo: 'giornaliero', genera: () => allegatoGiornaliero(dataReport) });
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
        genera: () =>
          allegatoPeriodico(
            'settimanale',
            inizio,
            dataReport,
            'Report settimanale',
            formattaIntervalloItaliano(inizio, dataReport)
          ),
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
      const inizio = primoGiornoMese(meseDaData(dataReport));
      daPreparare.push({
        tipo: 'mensile',
        genera: () =>
          allegatoPeriodico('mensile', inizio, dataReport, 'Report mensile', formattaMeseItaliano(meseDaData(dataReport))),
      });
    }
  }

  if (daPreparare.length) {
    const allegati = await Promise.all(daPreparare.map((d) => d.genera()));
    const htmlGiornaliero = daPreparare.some((d) => d.tipo === 'giornaliero')
      ? await generaSchedaGiornalieraHtml(dataReport)
      : `<p>In allegato: ${daPreparare.map((d) => d.tipo).join(', ')}.</p>`;

    await inviaEmail({
      a: destinatarioReport(),
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
