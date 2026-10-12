import { eseguiCronPianificato } from '../eseguiCronPianificato';
import { lavoroReportNotturno } from '@/lib/cron/lavoroReportNotturno';

export const dynamic = 'force-dynamic';

// Vercel Cron chiama questa route una volta al giorno poco dopo la
// mezzanotte Europe/Rome (vedi vercel.json: "0 23 * * *" UTC, che cade
// sempre a/dopo mezzanotte Rome sia in ora solare che legale — specs/52
// - report-email-automatico.md). Protetta dal secret che Vercel Cron
// invia in automatico in Authorization: Bearer $CRON_SECRET quando la
// variabile d'ambiente CRON_SECRET è configurata sul progetto, verificato
// in eseguiCronPianificato.
//
// Il lavoro (report, PDF ed email) è in lib/cron/lavoroReportNotturno.ts,
// condiviso con il lancio a mano dell'admin (specs/63).
export function GET(request: Request) {
  return eseguiCronPianificato(request, 'report-presenze', lavoroReportNotturno);
}
