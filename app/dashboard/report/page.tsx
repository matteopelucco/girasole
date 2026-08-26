import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { AvvisoInconsistenza } from '@/components/AvvisoInconsistenza';
import { requireStaff } from '@/lib/auth';
import { sezioniEBambiniVisibili } from '@/lib/sezioni';
import { risolviPeriodoReport, aggregaConteggiPresenzePasti, type TipoReport } from '@/lib/report';
import { rigaComunicazione, totalePasti, raggruppaPerSezione, type ComunicazionePasto } from '@/lib/comunicazionePasti';

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

  const { sezioni, bambini } = await sezioniEBambiniVisibili(supabase, user.id, ruolo);

  const idBambini = bambini.map((b) => b.id);
  const [{ data: presenze }, { data: pasti }] = idBambini.length
    ? await Promise.all([
        supabase
          .from('presenze')
          .select('bambino_id, data, stato, pre_asilo, post_asilo')
          .in('bambino_id', idBambini)
          .gte('data', inizio)
          .lte('data', fine),
        supabase
          .from('pasti')
          .select('bambino_id, data, mangiato')
          .in('bambino_id', idBambini)
          .gte('data', inizio)
          .lte('data', fine),
      ])
    : [
        {
          data: [] as { bambino_id: string; data: string; stato: string; pre_asilo: boolean; post_asilo: boolean }[],
        },
        { data: [] as { bambino_id: string; data: string; mangiato: string }[] },
      ];

  const righePerBambino = new Map(
    aggregaConteggiPresenzePasti(bambini, presenze ?? [], pasti ?? []).map((r) => [r.id, r])
  );

  const idSezioni = sezioni.map((s) => s.id);
  const { data: comunicazioniData } = idSezioni.length
    ? await supabase
        .from('pasti_comunicati')
        .select('sezione_id, comunicato_at, numero_pasti, comunicato_da_nome')
        .in('sezione_id', idSezioni)
        .gte('data', inizio)
        .lte('data', fine)
        .order('data', { ascending: true })
    : {
        data: [] as { sezione_id: string; comunicato_at: string; numero_pasti: number; comunicato_da_nome: string }[],
      };
  const comunicazioni: ComunicazionePasto[] = (comunicazioniData ?? []).map((c) => ({
    sezioneId: c.sezione_id,
    comunicatoAt: c.comunicato_at,
    numeroPasti: c.numero_pasti,
    comunicatoDaNome: c.comunicato_da_nome,
  }));
  const comunicazioniPerSezione = raggruppaPerSezione(comunicazioni);
  const totaleComplessivo = totalePasti(comunicazioni);

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
          <a href="/dashboard" className="text-sm text-stone-600 hover:text-stone-900">
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
          const comunicazioniSezione = comunicazioniPerSezione.get(sezione.id) ?? [];
          return (
            <div key={sezione.id} className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
              <h2 className="text-sm font-semibold">{sezione.nome}</h2>
              {!lista.length && <p className="mt-2 text-sm text-stone-600">Nessun bambino in questa classe.</p>}
              {!!lista.length && (
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-stone-600">
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
                            <span className="flex flex-wrap items-center gap-1">
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
                              <AvvisoInconsistenza messaggi={riga?.inconsistenze ?? []} />
                            </span>
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
              {!!comunicazioniSezione.length && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <h3 className="text-xs font-semibold text-amber-900">Comunicazione pasti</h3>
                  <ul className="mt-1 space-y-0.5 text-xs text-amber-900">
                    {comunicazioniSezione.map((c, i) => (
                      <li key={i}>{rigaComunicazione(c)}</li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs font-semibold text-amber-900">
                    Totale: {totalePasti(comunicazioniSezione)} pasti
                  </p>
                </div>
              )}
            </div>
          );
        })}

        {comunicazioni.length > 0 && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
            Totale complessivo pasti comunicati a Rojac nel periodo: {totaleComplessivo}
          </p>
        )}
      </main>
    </>
  );
}
