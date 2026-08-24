import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { requireStaff } from '@/lib/auth';
import { sezioniAttiveVisibili } from '@/lib/sezioni';
import { risolviPeriodoReport, aggregaConteggiPresenzePasti, type TipoReport } from '@/lib/report';

export const dynamic = 'force-dynamic';

type Tipo = TipoReport;

const TIPI: { valore: Tipo; etichetta: string }[] = [
  { valore: 'mensile', etichetta: 'Mensile' },
  { valore: 'settimanale', etichetta: 'Settimanale' },
  { valore: 'giornaliero', etichetta: 'Giornaliero' },
];

export default async function ReportPage({
  searchParams,
}: {
  searchParams: { tipo?: string; periodo?: string };
}) {
  const { supabase, user, profilo, ruolo } = await requireStaff({});
  const nomeVisualizzato = profilo?.nome || user.email || '';
  const tipo: Tipo = TIPI.some((t) => t.valore === searchParams.tipo)
    ? (searchParams.tipo as Tipo)
    : 'mensile';

  const { inizio, fine, etichettaPeriodo, periodoPrecedente, periodoSuccessivo, periodoAttuale } =
    risolviPeriodoReport(tipo, searchParams.periodo);

  const sezioni = await sezioniAttiveVisibili(supabase, user.id, ruolo);
  const sezioneIds = sezioni.map((s) => s.id);

  let bambini: { id: string; nome: string; cognome: string; sezione_id: string | null }[] = [];
  if (ruolo === 'admin') {
    const { data } = await supabase
      .from('bambini')
      .select('id, nome, cognome, sezione_id')
      .eq('attiva', true)
      .order('cognome');
    bambini = data ?? [];
  } else if (sezioneIds.length) {
    const { data } = await supabase
      .from('bambini')
      .select('id, nome, cognome, sezione_id')
      .in('sezione_id', sezioneIds)
      .eq('attiva', true)
      .order('cognome');
    bambini = data ?? [];
  }

  const idBambini = bambini.map((b) => b.id);
  const [{ data: presenze }, { data: pasti }] = idBambini.length
    ? await Promise.all([
        supabase
          .from('presenze')
          .select('bambino_id, stato, pre_asilo, post_asilo')
          .in('bambino_id', idBambini)
          .gte('data', inizio)
          .lte('data', fine),
        supabase
          .from('pasti')
          .select('bambino_id, mangiato')
          .in('bambino_id', idBambini)
          .gte('data', inizio)
          .lte('data', fine),
      ])
    : [
        { data: [] as { bambino_id: string; stato: string; pre_asilo: boolean; post_asilo: boolean }[] },
        { data: [] as { bambino_id: string; mangiato: string }[] },
      ];

  const righePerBambino = new Map(
    aggregaConteggiPresenzePasti(bambini, presenze ?? [], pasti ?? []).map((r) => [r.id, r])
  );

  const bambiniPerSezione = new Map<string, typeof bambini>();
  for (const b of bambini) {
    if (!b.sezione_id) continue;
    const lista = bambiniPerSezione.get(b.sezione_id) ?? [];
    lista.push(b);
    bambiniPerSezione.set(b.sezione_id, lista);
  }

  const puoFareDrillDown = tipo !== 'giornaliero';

  return (
    <>
      <NavHeader nome={nomeVisualizzato} ruolo={ruolo} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div>
          <a href="/dashboard" className="text-sm text-stone-500 hover:text-stone-900">
            ← Torna alla dashboard
          </a>
          <h1 className="mt-2 text-lg font-medium">Report</h1>
        </div>

        <div className="flex flex-wrap gap-2">
          {TIPI.map((t) => (
            <Link
              key={t.valore}
              href={`/dashboard/report?tipo=${t.valore}`}
              className={
                t.valore === tipo
                  ? 'rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white'
                  : 'rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50'
              }
            >
              {t.etichetta}
            </Link>
          ))}
          <Link
            href="/dashboard/report/anagrafica"
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Anagrafica classi
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <Link
            href={`/dashboard/report?tipo=${tipo}&periodo=${periodoPrecedente}`}
            aria-label="Periodo precedente"
            className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            ←
          </Link>
          <span className="text-sm font-medium capitalize text-amber-900">{etichettaPeriodo}</span>
          <Link
            href={`/dashboard/report?tipo=${tipo}&periodo=${periodoSuccessivo}`}
            aria-label="Periodo successivo"
            className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            →
          </Link>
        </div>

        {!sezioni.length && <p className="text-sm text-stone-600">Nessuna classe assegnata.</p>}

        {sezioni.map((sezione) => {
          const lista = bambiniPerSezione.get(sezione.id) ?? [];
          return (
            <div key={sezione.id} className="rounded-lg border border-stone-200 p-3">
              <h2 className="text-sm font-semibold">{sezione.nome}</h2>
              {!lista.length && <p className="mt-2 text-sm text-stone-600">Nessun bambino in questa classe.</p>}
              {!!lista.length && (
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-stone-500">
                      <th className="py-1">Bambino</th>
                      <th className="py-1 text-right">Presenze</th>
                      <th className="py-1 text-right">Pre-asilo</th>
                      <th className="py-1 text-right">Post-asilo</th>
                      <th className="py-1 text-right">Pasti</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((b) => {
                      const riga = righePerBambino.get(b.id);
                      return (
                        <tr key={b.id} className="border-t border-stone-100">
                          <td className="py-1">
                            {puoFareDrillDown ? (
                              <Link
                                href={`/dashboard/report/bambino/${b.id}?tipo=${tipo}&periodo=${periodoAttuale}`}
                                className="hover:underline"
                              >
                                {b.nome} {b.cognome}
                              </Link>
                            ) : (
                              <span>
                                {b.nome} {b.cognome}
                              </span>
                            )}
                          </td>
                          <td className="py-1 text-right">{riga?.presenze ?? 0}</td>
                          <td className="py-1 text-right">{riga?.preAsilo ?? 0}</td>
                          <td className="py-1 text-right">{riga?.postAsilo ?? 0}</td>
                          <td className="py-1 text-right">{riga?.pasti ?? 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </main>
    </>
  );
}
