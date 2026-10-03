import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { oggi } from '@/lib/date';
import { meseOreLavoroRichiesto } from '@/lib/oreLavoroMese';
import { pdfOreLavoroMensile, pdfOreLavoroMensileDipendente } from '@/lib/reportOreLavoro';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Download del PDF mensile delle ore di lavoro (specs/18, sezione
// Amministrazione): lo stesso file che il job notturno allega alla mail del
// report mensile (lib/reportOreLavoro.ts), generato al volo e scaricato
// direttamente, senza alcun invio via email. Senza `utente` contiene tutto
// il personale (elenco `/admin/ore-lavoro`); con `?utente=<id>` solo quella
// persona (vista mensile): stesso codice e stesso layout, un solo
// dipendente. Riservato all'admin (requireAdmin riporta gli altri alla
// dashboard, prima di toccare qualunque dato). `?mese=AAAA-MM`: un valore
// assente, non valido o futuro vale il mese corrente (stesso clamp della
// vista mensile). Un `utente` non valido o non abilitato risponde 404.
export async function GET(request: Request) {
  await requireAdmin();

  const parametri = new URL(request.url).searchParams;
  const mese = meseOreLavoroRichiesto(parametri.get('mese') ?? undefined, oggi());
  const utente = parametri.get('utente');
  if (utente !== null && !UUID.test(utente)) return nonTrovato();

  // Client con la sessione dell'admin (non la service_role): la RLS
  // (`*_select_own_or_admin`, ecc.) gli consente già di leggere i dati di
  // tutto il personale, e resta la difesa anche se il controllo sopra
  // venisse meno (issue #213, sotto-issue di #38).
  const supabase = createClient();

  try {
    const pdf = utente
      ? await pdfOreLavoroMensileDipendente(supabase, mese, new Date(), utente)
      : await pdfOreLavoroMensile(supabase, mese, new Date());
    if (!pdf) return nonTrovato();
    return new NextResponse(pdf.content as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${pdf.filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (errore) {
    console.error('ore-lavoro: impossibile generare il PDF mensile', errore);
    return new NextResponse('Impossibile generare il PDF. Riprova tra poco.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

function nonTrovato() {
  return new NextResponse('Dipendente non trovato.', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
