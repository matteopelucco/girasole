import { NavHeader } from '@/components/NavHeader';
import { requireStaff } from '@/lib/auth';
import { sezioniComplete } from '@/lib/sezioni';
import { formattaDataBreve } from '@/lib/date';

export const dynamic = 'force-dynamic';

const ETICHETTA_SESSO: Record<string, string> = { M: 'Maschio', F: 'Femmina' };
const ETICHETTA_RUOLO_STAFF: Record<string, string> = { maestra: 'Maestra', assistente: 'Assistente' };

export default async function AnagraficaClassiPage() {
  const { supabase, user, profilo, ruolo } = await requireStaff({});
  const nomeVisualizzato = profilo?.nome || user.email || '';

  const sezioni = await sezioniComplete(supabase, user.id, ruolo);
  const sezioneIds = sezioni.map((s) => s.id);

  const [{ data: assegnazioni }, { data: maestreProfili }, { data: bambini }] = await Promise.all([
    sezioneIds.length
      ? supabase.from('maestre_sezioni').select('maestra_id, sezione_id').in('sezione_id', sezioneIds)
      : Promise.resolve({ data: [] as { maestra_id: string; sezione_id: string }[] }),
    supabase.from('profili').select('id, nome, cognome, ruolo').in('ruolo', ['maestra', 'assistente']),
    sezioneIds.length
      ? supabase
          .from('bambini')
          .select('id, nome, cognome, sesso, data_nascita, sezione_id')
          .in('sezione_id', sezioneIds)
          .order('cognome')
      : Promise.resolve({
          data: [] as {
            id: string;
            nome: string;
            cognome: string;
            sesso: string | null;
            data_nascita: string | null;
            sezione_id: string | null;
          }[],
        }),
  ]);

  const bambiniList = bambini ?? [];
  const idBambini = bambiniList.map((b) => b.id);

  const { data: genitoriRows } = idBambini.length
    ? await supabase.from('bambini_genitori').select('bambino_id, genitore_id').in('bambino_id', idBambini)
    : { data: [] as { bambino_id: string; genitore_id: string }[] };

  const idGenitori = Array.from(new Set((genitoriRows ?? []).map((g) => g.genitore_id)));
  const { data: genitoriProfili } = idGenitori.length
    ? await supabase.from('profili').select('id, nome, cognome, email, telefono').in('id', idGenitori)
    : {
        data: [] as { id: string; nome: string; cognome: string; email: string | null; telefono: string | null }[],
      };

  const genitoreById = new Map((genitoriProfili ?? []).map((g) => [g.id, g]));
  const genitoriPerBambino = new Map<string, NonNullable<typeof genitoriProfili>>();
  for (const link of genitoriRows ?? []) {
    const genitore = genitoreById.get(link.genitore_id);
    if (!genitore) continue;
    const lista = genitoriPerBambino.get(link.bambino_id) ?? [];
    lista.push(genitore);
    genitoriPerBambino.set(link.bambino_id, lista);
  }

  const maestraById = new Map((maestreProfili ?? []).map((m) => [m.id, m]));
  const maestrePerSezione = new Map<string, NonNullable<typeof maestreProfili>>();
  for (const a of assegnazioni ?? []) {
    const maestra = maestraById.get(a.maestra_id);
    if (!maestra) continue;
    const lista = maestrePerSezione.get(a.sezione_id) ?? [];
    lista.push(maestra);
    maestrePerSezione.set(a.sezione_id, lista);
  }

  const bambiniPerSezione = new Map<string, typeof bambiniList>();
  for (const b of bambiniList) {
    if (!b.sezione_id) continue;
    const lista = bambiniPerSezione.get(b.sezione_id) ?? [];
    lista.push(b);
    bambiniPerSezione.set(b.sezione_id, lista);
  }

  return (
    <NavHeader nome={nomeVisualizzato} ruolo={ruolo}>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <a href="/dashboard/report" className="text-sm text-stone-600 hover:text-stone-900">
            ← Torna al report
          </a>
          <h1 className="mt-2 text-lg font-medium">Anagrafica classi</h1>
        </div>

        {!sezioni.length && <p className="text-sm text-stone-600">Nessuna classe.</p>}

        {sezioni.map((sezione) => {
          const maestre = maestrePerSezione.get(sezione.id) ?? [];
          const lista = bambiniPerSezione.get(sezione.id) ?? [];
          return (
            <div key={sezione.id} className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-semibold">{sezione.nome}</h2>
              <p className="mt-1 text-sm text-stone-600">
                Staff assegnato:{' '}
                {maestre.length
                  ? maestre
                      .map((m) => `${m.nome} ${m.cognome} (${ETICHETTA_RUOLO_STAFF[m.ruolo] ?? m.ruolo})`)
                      .join(', ')
                  : 'Nessuno staff assegnato.'}
              </p>

              <ul className="mt-3 space-y-2">
                {lista.map((b) => {
                  const genitori = genitoriPerBambino.get(b.id) ?? [];
                  return (
                    <li key={b.id} className="rounded-lg border border-stone-100 p-2 text-sm">
                      <div className="font-medium">
                        {b.nome} {b.cognome}
                        {' — '}
                        {b.sesso ? ETICHETTA_SESSO[b.sesso] ?? b.sesso : '—'}
                        {' — '}
                        {b.data_nascita ? formattaDataBreve(b.data_nascita) : '—'}
                      </div>
                      <div className="mt-1 text-xs text-stone-600">
                        Genitori:{' '}
                        {genitori.length
                          ? genitori
                              .map((g) => `${g.nome} ${g.cognome} (${g.email ?? '—'}, ${g.telefono || '—'})`)
                              .join(' · ')
                          : 'Nessun genitore collegato.'}
                      </div>
                    </li>
                  );
                })}
                {!lista.length && <li className="text-xs text-stone-600">Nessun bambino.</li>}
              </ul>
            </div>
          );
        })}
      </main>
    </NavHeader>
  );
}
