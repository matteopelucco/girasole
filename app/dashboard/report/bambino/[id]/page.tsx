import { redirect } from 'next/navigation';
import { NavHeader } from '@/components/NavHeader';
import { AvvisoInconsistenza } from '@/components/AvvisoInconsistenza';
import { requireStaff } from '@/lib/auth';
import { formattaDataItaliana, giorniInRange } from '@/lib/date';
import { risolviPeriodoReport } from '@/lib/report';
import { inconsistenzeGiorno, type StatoPasto, type StatoPresenza } from '@/lib/consistenza';

export const dynamic = 'force-dynamic';

type Tipo = 'mensile' | 'settimanale';

const ETICHETTE_PRESENZA: Record<string, string> = {
  presente: 'Presente',
  assente: 'Assente',
  malattia: 'Malattia',
};

const ETICHETTE_PASTO: Record<string, string> = {
  si: 'Sì',
  no: 'No',
};

export default async function DrillDownBambinoPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tipo?: string; periodo?: string };
}) {
  const { supabase, user, profilo, ruolo } = await requireStaff({});
  const nomeVisualizzato = profilo?.nome || user.email || '';
  const tipo: Tipo = searchParams.tipo === 'settimanale' ? 'settimanale' : 'mensile';

  const { inizio, fine, etichettaPeriodo, periodoAttuale } = risolviPeriodoReport(
    tipo,
    searchParams.periodo
  );

  const { data: bambino } = await supabase
    .from('bambini')
    .select('id, nome, cognome')
    .eq('id', params.id)
    .maybeSingle();
  if (!bambino) redirect('/dashboard/report');

  const [{ data: presenze }, { data: pasti }] = await Promise.all([
    supabase
      .from('presenze')
      .select('data, stato, pre_asilo, post_asilo')
      .eq('bambino_id', params.id)
      .gte('data', inizio)
      .lte('data', fine),
    supabase.from('pasti').select('data, mangiato').eq('bambino_id', params.id).gte('data', inizio).lte('data', fine),
  ]);

  const presenzaPerGiorno = new Map((presenze ?? []).map((p) => [p.data, p]));
  const pastoPerGiorno = new Map((pasti ?? []).map((p) => [p.data, p.mangiato]));
  const giorni = giorniInRange(inizio, fine);

  return (
    <NavHeader nome={nomeVisualizzato} ruolo={ruolo}>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <a
            href={`/dashboard/report?tipo=${tipo}&periodo=${periodoAttuale}`}
            className="text-sm text-stone-600 hover:text-stone-900"
          >
            ← Torna al report
          </a>
          <h1 className="mt-2 text-lg font-medium">
            {bambino.nome} {bambino.cognome}
          </h1>
          <p className="text-sm capitalize text-stone-600">{etichettaPeriodo}</p>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-stone-600">
              <th className="py-1">Giorno</th>
              <th className="py-1">Presenza</th>
              <th className="py-1">Pre-asilo</th>
              <th className="py-1">Post-asilo</th>
              <th className="py-1">Pasto</th>
              <th className="py-1">Avviso</th>
            </tr>
          </thead>
          <tbody>
            {giorni.map((g) => {
              const presenza = presenzaPerGiorno.get(g);
              const mangiato = pastoPerGiorno.get(g);
              const problemi = inconsistenzeGiorno({
                stato: presenza?.stato as StatoPresenza | undefined,
                preAsilo: presenza?.pre_asilo,
                postAsilo: presenza?.post_asilo,
                mangiato: mangiato as StatoPasto | undefined,
              });
              return (
                <tr key={g} className="border-t border-stone-100">
                  <td className="py-1 capitalize">{formattaDataItaliana(g)}</td>
                  <td className="py-1">{ETICHETTE_PRESENZA[presenza?.stato ?? ''] ?? 'Non segnato'}</td>
                  <td className="py-1">{presenza?.pre_asilo ? 'Sì' : '—'}</td>
                  <td className="py-1">{presenza?.post_asilo ? 'Sì' : '—'}</td>
                  <td className="py-1">{ETICHETTE_PASTO[mangiato ?? ''] ?? 'Non segnato'}</td>
                  <td className="py-1">
                    <AvvisoInconsistenza messaggi={problemi} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </main>
    </NavHeader>
  );
}
