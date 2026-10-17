import { eseguiCronPianificato } from '../eseguiCronPianificato';
import { lavoroNotturno } from '@/lib/cron/lavoroNotturno';

export const dynamic = 'force-dynamic';
// La sincronizzazione del calendario (rete, fino a 8 secondi) gira insieme al
// report: si dichiara il tempo massimo consentito anche dal piano gratuito.
export const maxDuration = 60;

// Vercel Cron chiama questa route una volta al giorno poco dopo la
// mezzanotte Europe/Rome (vedi vercel.json: "0 23 * * *" UTC, che cade
// sempre a/dopo mezzanotte Rome sia in ora solare che legale — specs/52
// - report-email-automatico.md). Protetta dal secret che Vercel Cron
// invia in automatico in Authorization: Bearer $CRON_SECRET quando la
// variabile d'ambiente CRON_SECRET è configurata sul progetto, verificato
// in eseguiCronPianificato.
//
// Il lavoro (report, PDF ed email, più la sincronizzazione degli eventi del
// Google Calendar, specs/64) è in lib/cron/lavoroNotturno.ts, condiviso con il
// lancio a mano dell'admin (specs/63).
export function GET(request: Request) {
  return eseguiCronPianificato(request, 'report-presenze', lavoroNotturno);
}
