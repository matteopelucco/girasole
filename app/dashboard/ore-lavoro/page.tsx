import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { ConfermaAzione } from '@/components/ConfermaAzione';
import { RigaOreLavoro, ETICHETTE_STATO_ORE_LAVORO, type StatoGiornoOreLavoro } from '@/components/RigaOreLavoro';
import { requireStaff, assicuraAccessoOreLavoro } from '@/lib/auth';
import { oggi, giorniLavorativiSettimana, giornoSettimanaIso, formattaIntervalloItaliano, formattaDataBreve, formattaDataOraItaliana } from '@/lib/date';
import { oreOrdinariePreviste, totaliSettimanaOreLavoro } from '@/lib/oreLavoro';
import { recuperaProfiloOrario } from '@/lib/profiliOrari';
import { isGiornoChiuso, messaggioChiusura, chiusurePerPeriodo } from '@/lib/calendarioScolastico';
import { salvaSettimanaOreLavoro, confermaSettimanaOreLavoro } from './actions';

export const dynamic = 'force-dynamic';

const NOMI_GIORNI: Record<number, string> = {
  1: 'Lunedì',
  2: 'Martedì',
  3: 'Mercoledì',
  4: 'Giovedì',
  5: 'Venerdì',
};

// Sezione "Ore di lavoro" (specs/18 - report-ore-lavoro.md): il
// personale abilitato (specs/17) registra ore/malattia/assenza per la
// settimana corrente e la conferma. Una volta confermata, la pagina
// mostra i dati in sola lettura (nessun campo modificabile).
export default async function OreLavoroPage() {
  const { supabase, user, profilo, ruolo } = await requireStaff({});
  assicuraAccessoOreLavoro(profilo?.abilitato_ore_lavoro);

  const nomeVisualizzato = profilo?.nome || user.email || '';
  const giorni = giorniLavorativiSettimana(oggi());
  const [lunedi, , , , venerdi] = giorni;

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
    chiusurePerPeriodo(supabase, lunedi, venerdi),
  ]);

  const righePerGiorno = new Map((righeGiorni ?? []).map((r) => [r.data, r]));
  const confermata = !!settimana;

  const righe = giorni.map((data) => {
    const salvata = righePerGiorno.get(data);
    return {
      data,
      etichetta: NOMI_GIORNI[giornoSettimanaIso(data)],
      dataBreve: formattaDataBreve(data),
      chiuso: isGiornoChiuso(data, chiusure),
      messaggioChiuso: messaggioChiusura(data, chiusure),
      stato: (salvata?.stato ?? 'lavorativo') as StatoGiornoOreLavoro,
      oreOrdinarie: salvata ? salvata.ore_ordinarie : oreOrdinariePreviste(profiloOrario, data),
      oreStraordinarie: salvata?.ore_straordinarie ?? 0,
      motivoStraordinario: salvata?.motivo_straordinario ?? '',
      codiceMalattia: salvata?.codice_malattia ?? '',
      notaAssenza: salvata?.nota_assenza ?? '',
    };
  });

  const totali = totaliSettimanaOreLavoro(righe.filter((r) => !r.chiuso));

  return (
    <>
      <NavHeader nome={nomeVisualizzato} ruolo={ruolo} />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <div>
          <a href="/dashboard" className="text-sm text-stone-600 hover:text-stone-900">
            ← Torna alla dashboard
          </a>
          <h1 className="mt-2 text-lg font-medium">Ore di lavoro</h1>
          <p className="mt-1 text-sm text-stone-600">Settimana {formattaIntervalloItaliano(lunedi, venerdi)}</p>
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
                  {!r.chiuso && (
                    <span className="text-sm text-stone-600">{ETICHETTE_STATO_ORE_LAVORO[r.stato]}</span>
                  )}
                </div>
                {r.chiuso && <p className="mt-1 text-sm text-stone-600">{r.messaggioChiuso}</p>}
                {!r.chiuso && r.stato === 'lavorativo' && (
                  <p className="mt-1 text-sm text-stone-600">
                    Ordinarie: {r.oreOrdinarie}h · Straordinarie: {r.oreStraordinarie}h
                    {r.motivoStraordinario ? ` (${r.motivoStraordinario})` : ''}
                  </p>
                )}
                {!r.chiuso && r.stato === 'malattia' && (
                  <p className="mt-1 text-sm text-stone-600">Codice malattia: {r.codiceMalattia}</p>
                )}
                {!r.chiuso && r.stato === 'assenza' && (
                  <p className="mt-1 text-sm text-stone-600">Nota: {r.notaAssenza}</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <FormConEsito action={salvaSettimanaOreLavoro} className="space-y-2">
            <input type="hidden" name="settimana_inizio" value={lunedi} />
            {righe.map((r) =>
              r.chiuso ? (
                <div
                  key={r.data}
                  className="rounded-xl border border-dashed border-stone-300 bg-white p-3 text-sm text-stone-600"
                >
                  <span className="font-medium text-stone-800">
                    {r.etichetta} {r.dataBreve}
                  </span>{' '}
                  — {r.messaggioChiuso}
                </div>
              ) : (
                <RigaOreLavoro
                  key={r.data}
                  etichettaGiorno={r.etichetta}
                  dataBreve={r.dataBreve}
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
              )
            )}
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
    </>
  );
}
