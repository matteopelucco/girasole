import Link from 'next/link';
import { ElencoChiusure } from '@/components/ElencoChiusure';
import { createClient } from '@/lib/supabase/server';
import type { GiornoChiusura } from '@/lib/calendarioScolastico';

// Giorni di chiusura in corso e futuri, in sola lettura (specs/64, specs/53):
// contenuto della scheda "Giorni di chiusura". Una query a sé su
// `giorni_chiusura`: non ha niente a che fare con gli eventi di Google (vedi la
// regola di separazione in page.tsx). La lista è lo stesso componente della
// pagina admin (`ElencoChiusure`, modo lettura). L'unico posto dove si
// modificano resta /admin/calendario, a cui l'admin trova il rimando.
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
      ) : (
        <ElencoChiusure chiusure={chiusure} oggi={oggi} modo="lettura" />
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
