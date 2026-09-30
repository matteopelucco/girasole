import Link from 'next/link';
import { redirect } from 'next/navigation';
import { NavHeader } from '@/components/NavHeader';
import { SelettoreVistaOreLavoro } from '@/components/SelettoreVistaOreLavoro';
import { requireAdmin } from '@/lib/auth';
import {
  formattaGiornoSettimana,
  formattaIntervalloItaliano,
  formattaMeseItaliano,
  formattaDataBreve,
  lunediSettimana,
  meseDaData,
  meseSuccessivo,
  mesePrecedente,
  oggi,
  primoGiornoMese,
  sommaGiorni,
  ultimoGiornoMese,
} from '@/lib/date';
import { chiusurePerPeriodo } from '@/lib/calendarioScolastico';
import { ETICHETTE_STATO_ORE_LAVORO, formattaOreConSegno, isStatoNeutroOreLavoro } from '@/lib/oreLavoro';
import {
  meseOreLavoroRichiesto,
  righeMeseOreLavoro,
  riepilogoMeseOreLavoro,
  settimaneDelMese,
} from '@/lib/oreLavoroMese';
import { saldoMonteOre } from '@/lib/monteOre';
import { MonteOre } from '@/components/MonteOre';
import { CalcoloMensileMonteOre } from '@/components/CalcoloMensileMonteOre';
import { calcoloMensilePerUtente } from '@/lib/monteOreMensileDati';
import {
  aggiungiMovimentoMonteOre,
  eliminaMovimentoMonteOre,
  modificaMovimentoMonteOre,
} from '../actions';
import { recuperaProfiloOrario } from '@/lib/profiliOrari';

export const dynamic = 'force-dynamic';

// Vista mensile delle ore di un dipendente, per l'admin (specs/18,
// sezione "Amministrazione"): è la vista di default quando si apre una
// persona da `/admin/ore-lavoro`; la vista settimanale
// (`/dashboard/ore-lavoro?utente=<id>`) resta quella per correggere le
// ore. Solo admin (requireAdmin riporta gli altri alla dashboard); il
// mese richiesto (`?mese=AAAA-MM`) non è mai nel futuro
// (meseOreLavoroRichiesto).
export default async function OreLavoroMesePage({
  searchParams,
}: {
  searchParams: { mese?: string; utente?: string };
}) {
  const { supabase, user, profilo } = await requireAdmin();

  const utenteId = searchParams.utente;
  const { data: persona } = utenteId
    ? await supabase
        .from('profili')
        .select('id, nome, cognome, profilo_orario_id')
        .eq('id', utenteId)
        .eq('abilitato_ore_lavoro', true)
        .maybeSingle()
    : { data: null };
  if (!persona) redirect('/admin/ore-lavoro');

  const oggiData = oggi();
  const mese = meseOreLavoroRichiesto(searchParams.mese, oggiData);
  const meseCorrente = meseDaData(oggiData);
  const inizio = primoGiornoMese(mese);
  const fine = ultimoGiornoMese(mese);
  const settimane = settimaneDelMese(mese);

  const [profiloOrario, { data: salvati }, { data: confermate }, chiusure, { data: movimenti }] = await Promise.all([
    recuperaProfiloOrario(supabase, persona.profilo_orario_id),
    supabase
      .from('ore_lavoro_giorni')
      .select('data, stato, ore_ordinarie, ore_straordinarie, motivo_straordinario, codice_malattia, nota_assenza')
      .eq('utente_id', persona.id)
      .gte('data', inizio)
      .lte('data', fine),
    supabase
      .from('ore_lavoro_settimane')
      .select('settimana_inizio')
      .eq('utente_id', persona.id)
      .in('settimana_inizio', settimane),
    chiusurePerPeriodo(supabase, inizio, fine),
    supabase
      .from('monte_ore_movimenti')
      .select('id, tipo, settimana_inizio, variazione, nota, created_at')
      .eq('utente_id', persona.id)
      .order('created_at', { ascending: false }),
  ]);

  const righe = righeMeseOreLavoro({
    mese,
    oggiData,
    salvati: salvati ?? [],
    profiloOrario,
    chiusure,
  });
  const riepilogo = riepilogoMeseOreLavoro(righe);
  const settimaneConfermate = new Set((confermate ?? []).map((c) => c.settimana_inizio));
  const calcoloMensile = await calcoloMensilePerUtente(supabase, {
    utenteId: persona.id,
    profiloOrario,
    oggiData,
    movimenti: movimenti ?? [],
  });

  const nome = `${persona.nome} ${persona.cognome}`.trim();
  const suffissoUtente = `utente=${persona.id}`;
  // Settimana da mostrare passando alla vista settimanale: quella di oggi
  // se il mese è quello corrente, altrimenti la prima del mese.
  const settimanaDefault = mese === meseCorrente ? lunediSettimana(oggiData) : settimane[0];
  const hrefSettimana = (lunedi: string) => `/dashboard/ore-lavoro?settimana=${lunedi}&${suffissoUtente}`;

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <div>
          <a href="/admin/ore-lavoro" className="text-sm text-stone-600 hover:text-stone-900">
            ← Torna all&apos;elenco del personale
          </a>
          <h1 className="mt-2 text-lg font-medium">
            Ore di lavoro<span className="font-normal text-stone-600"> — {nome}</span>
          </h1>
        </div>

        <SelettoreVistaOreLavoro
          vista="mese"
          hrefMese={`/dashboard/ore-lavoro/mese?mese=${mese}&${suffissoUtente}`}
          hrefSettimana={hrefSettimana(settimanaDefault)}
        />

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <Link
            href={`/dashboard/ore-lavoro/mese?mese=${mesePrecedente(mese)}&${suffissoUtente}`}
            aria-label="Mese precedente"
            className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            ←
          </Link>
          <span className="text-sm font-medium capitalize text-amber-900">{formattaMeseItaliano(mese)}</span>
          {mese < meseCorrente && (
            <Link
              href={`/dashboard/ore-lavoro/mese?mese=${meseSuccessivo(mese)}&${suffissoUtente}`}
              aria-label="Mese successivo"
              className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              →
            </Link>
          )}
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-3 text-sm text-stone-600 shadow-sm">
          <p>
            Ore previste: <strong>{riepilogo.orePreviste}h</strong>
          </p>
          <p>
            Differenza ore: <strong>{formattaOreConSegno(riepilogo.differenza)}h</strong>
          </p>
        </div>

        <MonteOre
          saldo={saldoMonteOre(movimenti ?? [])}
          movimenti={movimenti ?? []}
          modalitaAdmin
          utenteId={persona.id}
          aggiungiMovimento={aggiungiMovimentoMonteOre}
          modificaMovimento={modificaMovimentoMonteOre}
          eliminaMovimento={eliminaMovimentoMonteOre}
        />

        <CalcoloMensileMonteOre righe={calcoloMensile} />

        <div className="rounded-xl border border-stone-200 bg-white p-3 text-sm shadow-sm">
          <h2 className="font-medium text-stone-800">Settimane del mese</h2>
          <ul className="mt-2 space-y-1">
            {settimane.map((lunedi) => {
              const confermata = settimaneConfermate.has(lunedi);
              return (
                <li key={lunedi}>
                  <Link
                    href={hrefSettimana(lunedi)}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-stone-800 hover:bg-stone-100"
                  >
                    <span>{formattaIntervalloItaliano(lunedi, sommaGiorni(lunedi, 6))}</span>
                    <span className={confermata ? 'text-emerald-800' : 'text-amber-800'}>
                      {confermata ? '✓ Confermata' : 'Non confermata'}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <ul className="space-y-2" aria-label="Giorni del mese">
          {righe.map((r) => {
            const futuro = r.data > oggiData;
            const vacanza = isStatoNeutroOreLavoro(r.stato);
            return (
              <li key={r.data} className="rounded-xl border border-stone-200 bg-white shadow-sm">
                <Link
                  href={hrefSettimana(lunediSettimana(r.data))}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 p-3"
                >
                  <span className="font-medium text-stone-900">
                    {formattaGiornoSettimana(r.data)}{' '}
                    <span className="font-normal text-stone-600">{formattaDataBreve(r.data)}</span>
                  </span>
                  <span className="text-sm text-stone-700">{ETICHETTE_STATO_ORE_LAVORO[r.stato]}</span>
                  {vacanza ? (
                    <span className="w-full text-sm text-stone-600">Giorno di vacanza: non conta nei totali.</span>
                  ) : (
                    <span className="w-full text-sm text-stone-700">
                      Previste {r.orePreviste}h
                      {r.stato === 'lavorativo' && (
                        <>
                          {' · '}Erogate {r.oreErogate}h{' · '}
                          <strong>Differenza {formattaOreConSegno(r.differenza)}h</strong>
                        </>
                      )}
                      {futuro && ' · non ancora trascorso'}
                    </span>
                  )}
                  {r.dettaglio && <span className="w-full text-sm text-stone-600">{r.dettaglio}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
    </NavHeader>
  );
}
