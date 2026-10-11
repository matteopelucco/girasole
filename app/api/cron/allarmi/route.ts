import { eseguiCronPianificato } from '../eseguiCronPianificato';
import { lavoroRiepilogoAllarmi } from '@/lib/cron/lavoroAllarmi';

export const dynamic = 'force-dynamic';

// Vercel Cron chiama questa route una volta al giorno dopo le 10:00
// Europe/Rome (vedi vercel.json: "30 11 * * *" UTC, che cade sempre
// dopo le 10:00 Rome sia in ora solare sia legale — specs/07 -
// allarmi.md). Protetta dallo stesso secret degli altri cron
// (Authorization: Bearer $CRON_SECRET), verificato in
// eseguiCronPianificato.
//
// Il lavoro (controlli ed email di riepilogo) è in lib/cron/lavoroAllarmi.ts,
// condiviso con il lancio a mano dell'admin (specs/63).
export function GET(request: Request) {
  return eseguiCronPianificato(request, 'allarmi', lavoroRiepilogoAllarmi);
}
