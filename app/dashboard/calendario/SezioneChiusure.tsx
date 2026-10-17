import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { chiusuraInCorso, formattaPeriodoChiusura, type GiornoChiusura } from '@/lib/calendarioScolastico';

// Giorni di chiusura in corso e futuri, in sola lettura (specs/64, specs/53).
// Una query a sé su `giorni_chiusura`: non ha niente a che fare con gli eventi
// di Google (vedi la regola di separazione in page.tsx). L'unico posto dove
// si modificano resta /admin/calendario, a cui l'admin trova il rimando.
export async function SezioneChiusure({ oggi, eAdmin }: { oggi: string; eAdmin: boolean }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('giorni_chiusura')
    .select('id, data_inizio, data_fine, nota')
    .gte('data_fine', oggi)
    .order('data_inizio', { ascending: true });

  if (error) console.error('Calendario: impossibile leggere i giorni di chiusura', error.message);

  const chiusure: GiornoChiusura[] = (data ?? []).map((r) => ({
    id: r.id,
    dataInizio: r.data_inizio,
    dataFine: r.data_fine,
    nota: r.nota,
  }));

  return (
    <>
      {error ? (
        <p className="rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
          Non è stato possibile leggere i giorni di chiusura. Riprova tra poco.
        </p>
      ) : chiusure.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-3 text-sm text-stone-700">
          Nessun giorno di chiusura in programma.
        </p>
      ) : (
        <ul className="space-y-2">
          {chiusure.map((chiusura) => (
            <li
              key={chiusura.id}
              data-testid="chiusura"
              className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 border-l-4 border-l-rose-400 bg-white px-3 py-2.5 shadow-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-stone-900">
                  {formattaPeriodoChiusura(chiusura.dataInizio, chiusura.dataFine)}
                </p>
                {chiusura.nota && <p className="text-sm text-stone-600 [overflow-wrap:anywhere]">{chiusura.nota}</p>}
              </div>
              {chiusuraInCorso(chiusura, oggi) && (
                <span className="shrink-0 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-900">
                  In corso
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-stone-600">Sabato e domenica sono chiusi sempre, non serve inserirli.</p>
      {eAdmin && (
        <Link
          href="/admin/calendario"
          className="inline-block text-sm font-medium text-emerald-800 underline underline-offset-2 hover:text-emerald-900"
        >
          Gestisci i giorni di chiusura
        </Link>
      )}
    </>
  );
}
