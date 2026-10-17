import type { SupabaseClient } from '@supabase/supabase-js';
import type { EsitoLavoroCron, OpzioniLavoroCron } from '@/lib/cronEsecuzioniDati';
import { lavoroReportNotturno, type RispostaReportNotturno } from '@/lib/cron/lavoroReportNotturno';
import { sincronizzaCalendario } from '@/lib/calendarioIcalDati';
import { problemaSincronizzazione, unisciProblemi, type RisultatoSincronizzazione } from '@/lib/calendarioIcal';

// Lavoro del job "Report notturno" (specs/52, specs/63): il report con le email
// e, insieme, la sincronizzazione degli eventi del Google Calendar (specs/64).
// Condiviso dalla route pianificata app/api/cron/report-presenze/route.ts e dal
// lancio a mano dell'admin (app/admin/cron-job/actions.ts).
//
// La sincronizzazione parte insieme al report, non lo precede: non lo ritarda
// e, non lanciando mai, non può farlo fallire. Se non riesce, il lancio
// risulta KO nel registro con una frase fissa ("Calendario non sincronizzato:
// …", senza indirizzo) ma il report viene prodotto come sempre. Se è il report
// a sollevare un errore, la sincronizzazione viene comunque portata a termine
// prima di rilanciarlo.
export type RispostaLavoroNotturno = RispostaReportNotturno & { calendario: RisultatoSincronizzazione };

// grant-check: service_role
export async function lavoroNotturno(
  supabase: SupabaseClient,
  opzioni: OpzioniLavoroCron
): Promise<EsitoLavoroCron<RispostaLavoroNotturno>> {
  // sincronizzaCalendario non lancia mai.
  const sincronizzazione = sincronizzaCalendario(supabase);
  let report: EsitoLavoroCron<RispostaReportNotturno>;
  try {
    report = await lavoroReportNotturno(supabase, opzioni);
  } catch (errore) {
    await sincronizzazione;
    throw errore;
  }
  const calendario = await sincronizzazione;
  return {
    dati: { ...report.dati, calendario },
    problema: unisciProblemi(report.problema, problemaSincronizzazione(calendario)),
  };
}
