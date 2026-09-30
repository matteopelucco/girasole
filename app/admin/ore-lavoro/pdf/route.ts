import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { oggi } from '@/lib/date';
import { meseOreLavoroRichiesto } from '@/lib/oreLavoroMese';
import { pdfOreLavoroMensile } from '@/lib/reportOreLavoro';

export const dynamic = 'force-dynamic';

// Download del PDF mensile delle ore di lavoro del personale (specs/18,
// sezione Amministrazione): lo stesso file che il job notturno allega
// alla mail del report mensile (lib/reportOreLavoro.ts:pdfOreLavoroMensile),
// generato al volo e scaricato direttamente, senza alcun invio via email.
// Riservato all'admin (requireAdmin riporta gli altri alla dashboard,
// prima di toccare qualunque dato: il PDF contiene tutto il personale).
// `?mese=AAAA-MM`: un valore assente, non valido o futuro vale il mese
// corrente (stesso clamp della vista mensile).
export async function GET(request: Request) {
  await requireAdmin();

  const mese = meseOreLavoroRichiesto(new URL(request.url).searchParams.get('mese') ?? undefined, oggi());

  try {
    const { filename, content } = await pdfOreLavoroMensile(mese, new Date());
    return new NextResponse(content as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
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
