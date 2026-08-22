import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { inviaEmail } from '@/lib/email';
import { generaSchedaGiornalieraHtml } from '@/lib/reportPresenze';
import { oggi, sommaGiorni, formattaDataItaliana } from '@/lib/date';

const DESTINATARIO = 'info@asilosartorio.it';

export const dynamic = 'force-dynamic';

// Vercel Cron chiama questa route una volta al giorno poco dopo la
// mezzanotte Europe/Rome (vedi vercel.json: "0 23 * * *" UTC, che cade
// sempre a/dopo mezzanotte Rome sia in ora solare che legale — specs/13
// - segna-presenza.md). Protetta dal secret che Vercel Cron invia in
// automatico in Authorization: Bearer $CRON_SECRET quando la variabile
// d'ambiente CRON_SECRET è configurata sul progetto.
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
  const { data: giaInviato } = await supabase
    .from('report_giornalieri_inviati')
    .select('data')
    .eq('data', dataReport)
    .maybeSingle();

  if (giaInviato) {
    return NextResponse.json({ ok: true, giaInviato: true, data: dataReport });
  }

  const html = await generaSchedaGiornalieraHtml(dataReport);
  await inviaEmail({
    a: DESTINATARIO,
    oggetto: `Presenze del ${formattaDataItaliana(dataReport)}`,
    html,
  });

  await supabase.from('report_giornalieri_inviati').insert({ data: dataReport });

  return NextResponse.json({ ok: true, data: dataReport });
}
