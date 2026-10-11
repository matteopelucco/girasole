import type { SupabaseClient } from '@supabase/supabase-js';
import type { EsitoLavoroCron, OpzioniLavoroCron } from '@/lib/cronEsecuzioniDati';
import { problemaReportNotturno } from '@/lib/cronEsecuzioni';
import { inviaEmail, destinatarioNotifiche, type AllegatoEmail } from '@/lib/email';
import {
  formattaTabellaReportHtml,
  aggregaGiornoTutteLeClassi,
  aggregaReportPeriodoTutteLeClassi,
  recuperaComunicazioniPastiPeriodo,
  type SezioneConRighe,
} from '@/lib/reportPresenze';
import { generaPdfTabellare, type SezionePdf, type ComunicazionePastiPdf } from '@/lib/pdfReport';
import { rigaComunicazione, totalePasti, type ComunicazionePasto } from '@/lib/comunicazionePasti';
import type { RigaReportBambino } from '@/lib/report';
import {
  INTESTAZIONI_GIORNALIERO,
  PESI_COLONNE_GIORNALIERO,
  anomalieDati,
  celleGiornaliere,
  descrizioniAllegati,
  formattaCorpoIntroduttivoHtml,
  type SezioneGiornaliera,
  type TipoReportNotturno,
} from '@/lib/reportNotturno';
import { generaRiepilogoOreLavoroSettimanaHtml, pdfOreLavoroMensile } from '@/lib/reportOreLavoro';
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

// Lavoro del job "Report notturno" (specs/52 - report-email-automatico.md),
// condiviso dalla route pianificata app/api/cron/report-presenze/route.ts
// (Vercel Cron, protetta da CRON_SECRET) e dal lancio a mano dell'admin
// (app/admin/cron-job/actions.ts, specs/63 "Lancio a mano"). Il client arriva
// da chi chiama: la service_role, perché il report copre tutto l'asilo.

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
  sottotitolo: string,
  generatoIl: Date
): Promise<AllegatoEmail> {
  const [sezioniDati, comunicazioni] = await Promise.all([
    aggregaReportPeriodoTutteLeClassi(inizio, fine),
    recuperaComunicazioniPastiPeriodo(inizio, fine),
  ]);
  const pdf = await generaPdfTabellare(
    titolo,
    sottotitolo,
    sezioniPdf(sezioniDati, ['Bambino', 'Presenze', 'Pre-asilo', 'Post-asilo', 'Pasti']),
    generatoIl,
    comunicazionePastiPdf(comunicazioni)
  );
  return { filename: `report-${tipo}-${fine}.pdf`, content: pdf };
}

// Il report giornaliero ha stato di presenza e nota (specs/52, "report
// giornaliero con stato di presenza e nota"): sezioni già aggregate dal
// chiamante, che le riusa anche per corpo email e anomalie.
async function allegatoGiornaliero(
  data: string,
  sezioni: SezioneGiornaliera[],
  comunicazioni: ComunicazionePasto[],
  generatoIl: Date
): Promise<AllegatoEmail> {
  const pdf = await generaPdfTabellare(
    'Report giornaliero',
    formattaDataItaliana(data),
    sezioni.map((s) => ({
      nome: s.nome,
      intestazioni: INTESTAZIONI_GIORNALIERO,
      righe: s.righe.map(celleGiornaliere),
      pesiColonne: PESI_COLONNE_GIORNALIERO,
    })),
    generatoIl,
    comunicazionePastiPdf(comunicazioni)
  );
  return { filename: `report-giornaliero-${data}.pdf`, content: pdf };
}

// PDF mensile delle ore di lavoro del personale (specs/52, scenario
// "PDF mensile delle ore del personale in allegato"; specs/19 -
// monte-ore.md): allegato insieme al report mensile di presenze/pasti,
// stessa idempotenza (nessun tracciamento separato — vedi Regole).
function allegatoOreLavoroMensile(supabase: SupabaseClient, mese: string, generatoIl: Date): Promise<AllegatoEmail> {
  return pdfOreLavoroMensile(supabase, mese, generatoIl);
}

export type RisultatoReport = 'inviato' | 'gia_inviato' | 'saltato' | 'errore';

export type RispostaReportNotturno = {
  ok: true;
  data: string;
  risultati: Record<TipoReportNotturno, RisultatoReport>;
  allegati: string[];
  anomalie: number;
};

// Registri che evitano di inviare due volte lo stesso report (specs/52,
// idempotenza): `report_giornalieri_inviati` per il giornaliero,
// `report_periodici_inviati` per settimanale e mensile.
// grant-check: service_role
async function reportGiaInviato(supabase: SupabaseClient, tipo: TipoReportNotturno, data: string): Promise<boolean> {
  const query =
    tipo === 'giornaliero'
      ? supabase.from('report_giornalieri_inviati').select('data').eq('data', data)
      : supabase.from('report_periodici_inviati').select('data').eq('tipo', tipo).eq('data', data);
  const { data: riga } = await query.maybeSingle();
  return Boolean(riga);
}

// grant-check: service_role
async function segnaReportInviato(supabase: SupabaseClient, tipo: TipoReportNotturno, data: string): Promise<void> {
  if (tipo === 'giornaliero') {
    await supabase.from('report_giornalieri_inviati').insert({ data });
  } else {
    await supabase.from('report_periodici_inviati').insert({ tipo, data });
  }
}

// Il lavoro del cron. Lancio a mano (`estemporaneo`, specs/63): i registri
// degli invii non si leggono (ogni report dovuto si rigenera e si invia, anche
// se il lancio pianificato l'ha già mandato) e non si scrivono (il lancio
// pianificato successivo parte comunque).
// grant-check: service_role
export async function lavoroReportNotturno(
  supabase: SupabaseClient,
  { estemporaneo }: OpzioniLavoroCron
): Promise<EsitoLavoroCron<RispostaReportNotturno>> {
  // Il cron gira poco dopo la mezzanotte Rome: oggi() è già il nuovo
  // giorno, quindi il giorno da riepilogare è quello appena concluso.
  const dataReport = sommaGiorni(oggi(), -1);
  // Istante di generazione, stampato in testa a ogni PDF (specs/52).
  const generatoIl = new Date();
  const giaInviato = (tipo: TipoReportNotturno) =>
    estemporaneo ? Promise.resolve(false) : reportGiaInviato(supabase, tipo, dataReport);

  const risultati: Record<TipoReportNotturno, RisultatoReport> = {
    giornaliero: 'saltato',
    settimanale: 'saltato',
    mensile: 'saltato',
  };

  // Ogni voce genera uno o più allegati per lo stesso tipo di report:
  // il mensile ne genera due (presenze/pasti + ore di lavoro, specs/52),
  // gli altri uno solo — un array uniforme evita un caso speciale nel
  // punto di invio sotto.
  const daPreparare: { tipo: TipoReportNotturno; genera: () => Promise<AllegatoEmail[]> }[] = [];
  // Dati del giorno, letti una volta sola dal giornaliero e riusati per
  // corpo dell'email e anomalie.
  const giorno: { sezioni?: SezioneGiornaliera[] } = {};

  if (await giaInviato('giornaliero')) {
    risultati.giornaliero = 'gia_inviato';
  } else {
    daPreparare.push({
      tipo: 'giornaliero',
      genera: async () => {
        const [sezioni, comunicazioni] = await Promise.all([
          aggregaGiornoTutteLeClassi(dataReport),
          recuperaComunicazioniPastiPeriodo(dataReport, dataReport),
        ]);
        giorno.sezioni = sezioni;
        return [await allegatoGiornaliero(dataReport, sezioni, comunicazioni, generatoIl)];
      },
    });
  }

  const modalita = modalitaPeriodici();

  if (modalita === 'sempre' || isUltimoGiornoSettimana(dataReport)) {
    if (await giaInviato('settimanale')) {
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
            formattaIntervalloItaliano(inizio, dataReport),
            generatoIl
          ),
        ],
      });
    }
  }

  if (modalita === 'sempre' || isUltimoGiornoMese(dataReport)) {
    if (await giaInviato('mensile')) {
      risultati.mensile = 'gia_inviato';
    } else {
      const mese = meseDaData(dataReport);
      const inizio = primoGiornoMese(mese);
      daPreparare.push({
        tipo: 'mensile',
        genera: async () => [
          await allegatoPeriodico('mensile', inizio, dataReport, 'Report mensile', formattaMeseItaliano(mese), generatoIl),
          await allegatoOreLavoroMensile(supabase, mese, generatoIl),
        ],
      });
    }
  }

  const allegatiNomi: string[] = [];

  if (daPreparare.length) {
    // Un report che non si riesce a produrre non blocca gli altri
    // (specs/52, "anomalia nella produzione di un report"): finisce tra le
    // anomalie della mail, senza dettagli tecnici (restano nei log), e non
    // viene marcato come inviato, così la prossima esecuzione lo ritenta.
    const esiti = await Promise.allSettled(daPreparare.map((d) => d.genera()));
    const riusciti: typeof daPreparare = [];
    const allegati: AllegatoEmail[] = [];
    const anomalie: string[] = [];
    esiti.forEach((esito, i) => {
      const d = daPreparare[i];
      if (esito.status === 'fulfilled') {
        riusciti.push(d);
        allegati.push(...esito.value);
      } else {
        console.error(`Report notturno ${d.tipo} non prodotto:`, esito.reason);
        risultati[d.tipo] = 'errore';
        anomalie.push(`Il report ${d.tipo} non è stato prodotto: verrà ritentato alla prossima esecuzione.`);
      }
    });

    if (giorno.sezioni) anomalie.push(...anomalieDati(giorno.sezioni, dataReport));

    // Il riepilogo ore di lavoro (specs/52, specs/19) è parte del corpo
    // "dettagliato" giornaliero, non un allegato a parte: compare solo
    // quando il giornaliero è stato davvero (ri)generato.
    let corpoGiornaliero = '';
    if (giorno.sezioni) {
      corpoGiornaliero = formattaTabellaReportHtml(`Presenze del ${formattaDataItaliana(dataReport)}`, giorno.sezioni);
      try {
        corpoGiornaliero += await generaRiepilogoOreLavoroSettimanaHtml(supabase, dataReport);
      } catch (errore) {
        console.error('Riepilogo ore di lavoro non prodotto:', errore);
        anomalie.push('Il riepilogo delle ore di lavoro non è stato prodotto.');
      }
    }

    const html =
      formattaCorpoIntroduttivoHtml({
        dataReport,
        generatoIl,
        descrizioni: descrizioniAllegati(
          riusciti.map((d) => d.tipo),
          dataReport
        ),
        anomalie,
      }) + corpoGiornaliero;

    await inviaEmail({
      a: destinatarioNotifiche(),
      oggetto: `Report del ${formattaDataItaliana(dataReport)}`,
      html,
      allegati,
    });
    allegatiNomi.push(...allegati.map((a) => a.filename));

    for (const d of riusciti) {
      if (!estemporaneo) await segnaReportInviato(supabase, d.tipo, dataReport);
      risultati[d.tipo] = 'inviato';
    }

    return {
      dati: { ok: true, data: dataReport, risultati, allegati: allegatiNomi, anomalie: anomalie.length },
      problema: problemaReportNotturno(risultati),
    };
  }

  return { dati: { ok: true, data: dataReport, risultati, allegati: allegatiNomi, anomalie: 0 } };
}
