import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { ConfermaAzione } from '@/components/ConfermaAzione';
import { RigaOreLavoro, ETICHETTE_STATO_ORE_LAVORO, type StatoGiornoOreLavoro } from '@/components/RigaOreLavoro';
import { requireStaff, assicuraAccessoOreLavoro } from '@/lib/auth';
import {
  oggi,
  sommaGiorni,
  giorniSettimana,
  giornoSettimanaIso,
  lunediSettimana,
  formattaIntervalloItaliano,
  formattaDataBreve,
  formattaDataOraItaliana,
} from '@/lib/date';
import {
  oreOrdinariePreviste,
  totaliSettimanaOreLavoro,
  notaGiornoChiusoOreLavoro,
  settimanaOreLavoroRichiesta,
} from '@/lib/oreLavoro';
import { recuperaProfiloOrario } from '@/lib/profiliOrari';
import { isGiornoChiuso, chiusurePerPeriodo } from '@/lib/calendarioScolastico';
import { salvaSettimanaOreLavoro, confermaSettimanaOreLavoro } from './actions';

export const dynamic = 'force-dynamic';

const NOMI_GIORNI: Record<number, string> = {
  1: 'Lunedì',
  2: 'Martedì',
  3: 'Mercoledì',
  4: 'Giovedì',
  5: 'Venerdì',
  6: 'Sabato',
  7: 'Domenica',
};

// Sezione "Ore di lavoro" (specs/18 - report-ore-lavoro.md): il
// personale abilitato (specs/17) registra ore/malattia/assenza per una
// settimana (tutti i 7 giorni: il personale può lavorare anche nei
// giorni in cui l'asilo è chiuso, specs/53) e la conferma. Può navigare
// a qualunque settimana passata per rivederla o confermarla, mai a una
// futura (?settimana=, un lunedì — risolto/clampato da
// settimanaOreLavoroRichiesta). Una volta confermata, la settimana in
// questione è mostrata in sola lettura.
export default async function OreLavoroPage({ searchParams }: { searchParams: { settimana?: string } }) {
  const { supabase, user, profilo, ruolo } = await requireStaff({});
  assicuraAccessoOreLavoro(profilo?.abilitato_ore_lavoro);

  const nomeVisualizzato = profilo?.nome || user.email || '';
  const inizioSettimanaCorrente = lunediSettimana(oggi());
  const lunedi = settimanaOreLavoroRichiesta(searchParams.settimana, oggi());
  const giorni = giorniSettimana(lunedi);
  const domenica = giorni[giorni.length - 1];
  const settimanaPrecedente = sommaGiorni(lunedi, -7);
  const puoAndareAvanti = lunedi < inizioSettimanaCorrente;
  const settimanaSuccessiva = sommaGiorni(lunedi, 7);

  const [profiloOrario, { data: righeGiorni }, { data: settimana }, chiusure] = await Promise.all([
    recuperaProfiloOrario(supabase, profilo?.profilo_orario_id),
    supabase
      .from('ore_lavoro_giorni')
      .select('data, stato, ore_ordinarie, ore_straordinarie, motivo_straordinario, codice_malattia, nota_assenza')
      .eq('utente_id', user.id)
      .in('data', giorni),
    supabase
      .from('ore_lavoro_settimane')
      .select('confermata_at')
      .eq('utente_id', user.id)
      .eq('settimana_inizio', lunedi)
      .maybeSingle(),
    chiusurePerPeriodo(supabase, lunedi, domenica),
  ]);

  const righePerGiorno = new Map((righeGiorni ?? []).map((r) => [r.data, r]));
  const confermata = !!settimana;

  const righe = giorni.map((data) => {
    const salvata = righePerGiorno.get(data);
    return {
      data,
      etichetta: NOMI_GIORNI[giornoSettimanaIso(data)],
      dataBreve: formattaDataBreve(data),
      // Solo informativo: il registro ore di lavoro non blocca la
      // scrittura nei giorni di chiusura scolastica (specs/18, specs/53
      // — a differenza di presenze/pasti, il personale può lavorare
      // anche quando l'asilo non è operativo).
      chiuso: isGiornoChiuso(data, chiusure),
      messaggioChiuso: notaGiornoChiusoOreLavoro(data, chiusure),
      stato: (salvata?.stato ?? 'lavorativo') as StatoGiornoOreLavoro,
      oreOrdinarie: salvata ? salvata.ore_ordinarie : oreOrdinariePreviste(profiloOrario, data),
      oreStraordinarie: salvata?.ore_straordinarie ?? 0,
      motivoStraordinario: salvata?.motivo_straordinario ?? '',
      codiceMalattia: salvata?.codice_malattia ?? '',
      notaAssenza: salvata?.nota_assenza ?? '',
    };
  });

  const totali = totaliSettimanaOreLavoro(righe);

  return (
    <NavHeader nome={nomeVisualizzato} ruolo={ruolo}>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <div>
          <a href="/dashboard" className="text-sm text-stone-600 hover:text-stone-900">
            ← Torna alla dashboard
          </a>
          <h1 className="mt-2 text-lg font-medium">Ore di lavoro</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <Link
            href={`/dashboard/ore-lavoro?settimana=${settimanaPrecedente}`}
            aria-label="Settimana precedente"
            className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            ←
          </Link>
          <span className="text-sm font-medium text-amber-900">{formattaIntervalloItaliano(lunedi, domenica)}</span>
          {puoAndareAvanti && (
            <Link
              href={`/dashboard/ore-lavoro?settimana=${settimanaSuccessiva}`}
              aria-label="Settimana successiva"
              className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              →
            </Link>
          )}
        </div>

        {confermata && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            Settimana confermata il {formattaDataOraItaliana(settimana!.confermata_at).replace('_', ' alle ')}.
          </p>
        )}

        {confermata ? (
          <div className="space-y-2">
            {righe.map((r) => (
              <div key={r.data} className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {r.etichetta} <span className="font-normal text-stone-600">{r.dataBreve}</span>
                  </span>
                  <span className="text-sm text-stone-600">{ETICHETTE_STATO_ORE_LAVORO[r.stato]}</span>
                </div>
                {r.chiuso && <p className="mt-1 text-xs text-stone-500">{r.messaggioChiuso}</p>}
                {r.stato === 'lavorativo' && (
                  <p className="mt-1 text-sm text-stone-600">
                    Ordinarie: {r.oreOrdinarie}h · Straordinarie: {r.oreStraordinarie}h
                    {r.motivoStraordinario ? ` (${r.motivoStraordinario})` : ''}
                  </p>
                )}
                {r.stato === 'malattia' && (
                  <p className="mt-1 text-sm text-stone-600">Codice malattia: {r.codiceMalattia}</p>
                )}
                {r.stato === 'assenza' && <p className="mt-1 text-sm text-stone-600">Nota: {r.notaAssenza}</p>}
              </div>
            ))}
          </div>
        ) : (
          <FormConEsito action={salvaSettimanaOreLavoro} className="space-y-2">
            <input type="hidden" name="settimana_inizio" value={lunedi} />
            {righe.map((r) => (
              <RigaOreLavoro
                key={r.data}
                etichettaGiorno={r.etichetta}
                dataBreve={r.dataBreve}
                messaggioChiuso={r.chiuso ? r.messaggioChiuso : null}
                valori={{
                  data: r.data,
                  stato: r.stato,
                  oreOrdinarie: r.oreOrdinarie,
                  oreStraordinarie: r.oreStraordinarie,
                  motivoStraordinario: r.motivoStraordinario,
                  codiceMalattia: r.codiceMalattia,
                  notaAssenza: r.notaAssenza,
                }}
              />
            ))}
            <PulsanteInvio className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
              Salva modifiche
            </PulsanteInvio>
          </FormConEsito>
        )}

        <p className="rounded-xl border border-stone-200 bg-white p-3 text-sm text-stone-600 shadow-sm">
          Totale settimana: {totali.ordinarie}h ordinarie + {totali.straordinarie}h straordinarie ={' '}
          <strong>{totali.totale}h</strong>
        </p>

        {!confermata && (
          <ConfermaAzione
            azione={confermaSettimanaOreLavoro}
            campiNascosti={{ settimana_inizio: lunedi }}
            etichetta="Conferma settimana"
            messaggioConferma="Confermi le ore di questa settimana? Da questo momento non potrai più modificarle autonomamente."
            tono="neutro"
          />
        )}
      </main>
    </NavHeader>
  );
}
