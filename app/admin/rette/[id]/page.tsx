import { redirect } from 'next/navigation';
import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { CelleImportiRetta } from '@/components/CelleImportiRetta';
import { requireAdmin } from '@/lib/auth';
import { importiPerMese, mesiAnnoScolastico, recuperaAnnoScolasticoCorrente, totaleImporti } from '@/lib/pagamentiRetta';

export const dynamic = 'force-dynamic';

export default async function RettaBambinoDettaglioPage({ params }: { params: { id: string } }) {
  const { supabase, user, profilo } = await requireAdmin();

  const { data: bambino } = await supabase
    .from('bambini')
    .select('id, nome, cognome')
    .eq('id', params.id)
    .maybeSingle();

  if (!bambino) redirect('/admin/rette');

  const annoScolasticoCorrente = await recuperaAnnoScolasticoCorrente(supabase);

  const mesi = annoScolasticoCorrente ? mesiAnnoScolastico(annoScolasticoCorrente.anno_inizio) : [];
  const { data: pagamenti } = annoScolasticoCorrente
    ? await supabase
        .from('pagamenti_retta')
        .select('mese, importo')
        .eq('bambino_id', bambino.id)
        .in(
          'mese',
          mesi.map((m) => m.mese)
        )
    : { data: [] };

  const mappa = importiPerMese(
    (pagamenti ?? []).map((p) => ({ mese: p.mese, importo: Number(p.importo) })),
    mesi
  );
  const totale = totaleImporti(mesi.map((m) => mappa.get(m.mese) ?? 0));

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <Link href="/admin/rette" className="text-sm text-stone-600 hover:text-stone-900">
          ← Torna a Rette
        </Link>

        <h1 className="text-lg font-medium">
          {bambino.nome} {bambino.cognome}
        </h1>

        {!annoScolasticoCorrente ? (
          <p className="text-sm text-stone-600">
            Nessun anno scolastico è impostato come corrente. Vai su{' '}
            <Link href="/admin" className="underline">
              Sezioni e bambini
            </Link>{' '}
            per impostarne uno.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-stone-200 text-sm">
              <thead>
                <tr>
                  {mesi.map((mese) => (
                    <th key={mese.mese} scope="col" className="px-3 py-2 text-right font-medium text-stone-700">
                      {mese.etichetta}
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2 text-right font-medium text-stone-700">
                    Totale
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <CelleImportiRetta mesi={mesi} importiPerMese={mappa} totale={totale} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </main>
    </NavHeader>
  );
}
