import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { CelleImportiRetta } from '@/components/CelleImportiRetta';
import { requireAdmin } from '@/lib/auth';
import { importiPerMese, mesiAnnoScolastico, recuperaAnnoScolasticoCorrente, totaleImporti } from '@/lib/pagamentiRetta';

export const dynamic = 'force-dynamic';

export default async function RettePage() {
  const { supabase, user, profilo } = await requireAdmin();

  const annoScolasticoCorrente = await recuperaAnnoScolasticoCorrente(supabase);

  if (!annoScolasticoCorrente) {
    return (
      <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
        <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
          <h1 className="text-lg font-medium">Rette</h1>
          <p className="text-sm text-stone-600">
            Nessun anno scolastico è impostato come corrente. Vai su{' '}
            <Link href="/admin" className="underline">
              Sezioni e bambini
            </Link>{' '}
            per impostarne uno.
          </p>
        </main>
      </NavHeader>
    );
  }

  const mesi = mesiAnnoScolastico(annoScolasticoCorrente.anno_inizio);

  const { data: sezioni } = await supabase
    .from('sezioni')
    .select('id, nome')
    .eq('anno_scolastico_id', annoScolasticoCorrente.id)
    .order('nome');

  const sezioneIds = (sezioni ?? []).map((s) => s.id);

  const { data: bambini } = sezioneIds.length
    ? await supabase
        .from('bambini')
        .select('id, nome, cognome, sezione_id')
        .eq('attiva', true)
        .in('sezione_id', sezioneIds)
        .order('cognome')
    : { data: [] };

  const bambinoIds = (bambini ?? []).map((b) => b.id);

  const { data: pagamenti } = bambinoIds.length
    ? await supabase
        .from('pagamenti_retta')
        .select('bambino_id, mese, importo')
        .in('bambino_id', bambinoIds)
        .in(
          'mese',
          mesi.map((m) => m.mese)
        )
    : { data: [] };

  const pagamentiPerBambino = new Map<string, { mese: string; importo: number }[]>();
  for (const pagamento of pagamenti ?? []) {
    const lista = pagamentiPerBambino.get(pagamento.bambino_id) ?? [];
    lista.push({ mese: pagamento.mese, importo: Number(pagamento.importo) });
    pagamentiPerBambino.set(pagamento.bambino_id, lista);
  }

  const bambiniPerSezione = new Map<string, typeof bambini>();
  for (const bambino of bambini ?? []) {
    if (!bambino.sezione_id) continue;
    const lista = bambiniPerSezione.get(bambino.sezione_id) ?? [];
    lista.push(bambino);
    bambiniPerSezione.set(bambino.sezione_id, lista);
  }

  const righe = (sezioni ?? []).flatMap((sezione) =>
    (bambiniPerSezione.get(sezione.id) ?? []).map((bambino) => {
      const mappa = importiPerMese(pagamentiPerBambino.get(bambino.id) ?? [], mesi);
      const totale = totaleImporti(mesi.map((m) => mappa.get(m.mese) ?? 0));
      return { bambino, sezioneNome: sezione.nome, mappa, totale };
    })
  );

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-lg font-medium">Rette — {annoScolasticoCorrente.nome}</h1>
          <p className="mt-1 text-sm text-stone-600">
            Pagamenti registrati mese per mese, anno scolastico corrente.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead>
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium text-stone-700">
                  Bambino
                </th>
                <th scope="col" className="px-3 py-2 text-left font-medium text-stone-700">
                  Sezione
                </th>
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
            <tbody className="divide-y divide-stone-100">
              {righe.map(({ bambino, sezioneNome, mappa, totale }) => (
                <tr key={bambino.id}>
                  <th scope="row" className="whitespace-nowrap px-3 py-2 text-left font-normal">
                    <Link href={`/admin/rette/${bambino.id}`} className="hover:underline">
                      {bambino.nome} {bambino.cognome}
                    </Link>
                  </th>
                  <td className="whitespace-nowrap px-3 py-2 text-left text-stone-600">{sezioneNome}</td>
                  <CelleImportiRetta mesi={mesi} importiPerMese={mappa} totale={totale} />
                </tr>
              ))}
              {!righe.length && (
                <tr>
                  <td colSpan={mesi.length + 3} className="px-3 py-4 text-center text-stone-600">
                    Nessun bambino attivo nelle sezioni dell&apos;anno scolastico corrente.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </NavHeader>
  );
}
