import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { ConfermaAzione } from '@/components/ConfermaAzione';
import { RigaOreLavoro } from '@/components/RigaOreLavoro';
import { classeCardOreLavoro, OrePreviste, TotaleOreErogate } from '@/components/CardOreLavoroParti';
import { requireStaff, assicuraAccessoOreLavoro } from '@/lib/auth';
import {
  oggi,
  sommaGiorni,
  giorniSettimana,
  formattaGiornoSettimana,
  lunediSettimana,
  formattaIntervalloItaliano,
  formattaDataBreve,
  formattaDataOraItaliana,
  meseDaData,
} from '@/lib/date';
import {
  oreOrdinariePreviste,
  arrotondaAQuartiDora,
  differenzaGiornoOreLavoro,
  formattaOreConSegno,
  totaleOreErogate,
  notaGiornoChiusoOreLavoro,
  settimanaOreLavoroRichiesta,
  ETICHETTE_STATO_ORE_LAVORO,
  isStatoNeutroOreLavoro,
  statoPredefinitoGiornoOreLavoro,
  TESTO_GIORNO_DI_VACANZA,
  type StatoGiornoOreLavoro,
} from '@/lib/oreLavoro';
import { saldoMonteOre, riepilogoSettimanaDaDifferenze } from '@/lib/monteOre';
import { RiepilogoSettimanaOreLavoro, SettimanaOreLavoroProvider } from '@/components/RiepilogoSettimanaOreLavoro';
import { recuperaProfiloOrario } from '@/lib/profiliOrari';
import { isGiornoChiuso, chiusurePerPeriodo } from '@/lib/calendarioScolastico';
import { MonteOre } from '@/components/MonteOre';
import { CalcoloMensileMonteOre } from '@/components/CalcoloMensileMonteOre';
import { calcoloMensilePerUtente } from '@/lib/monteOreMensileDati';
import { StraordinarioResiduo } from '@/components/StraordinarioResiduo';
import { SelettoreVistaOreLavoro } from '@/components/SelettoreVistaOreLavoro';
import {
  salvaSettimanaOreLavoro,
  confermaSettimanaOreLavoro,
  riapriSettimanaOreLavoro,
  aggiungiMovimentoMonteOre,
  eliminaMovimentoMonteOre,
  modificaMovimentoMonteOre,
  decidiStraordinarioResiduo,
} from './actions';

export const dynamic = 'force-dynamic';

// Sezione "Ore di lavoro" (specs/18 - report-ore-lavoro.md): il
// personale abilitato (specs/17) registra ore/malattia/assenza per una
// settimana (tutti i 7 giorni: il personale può lavorare anche nei
// giorni in cui l'asilo è chiuso, specs/53) e la conferma. Può navigare
// a qualunque settimana passata per rivederla o confermarla, mai a una
// futura (?settimana=, un lunedì — risolto/clampato da
// settimanaOreLavoroRichiesta). Una volta confermata, la settimana in
// questione è mostrata in sola lettura — TRANNE per l'admin, che può
// sempre modificare/correggere le ore di chiunque sia abilitato, anche
// una settimana già confermata (specs/18, sezione "Amministrazione"):
// `?utente=<id>` (solo per l'admin, altrimenti ignorato) sceglie di chi
// sono le ore mostrate, di default le proprie.
export default async function OreLavoroPage({
  searchParams,
}: {
  searchParams: { settimana?: string; utente?: string };
}) {
  const { supabase, user, profilo, ruolo } = await requireStaff({});

  let utenteTarget = {
    id: user.id,
    nome: profilo?.nome || user.email || '',
    profiloOrarioId: profilo?.profilo_orario_id ?? null,
  };
  let modalitaAdmin = false;

  if (ruolo === 'admin' && searchParams.utente && searchParams.utente !== user.id) {
    const { data: profiloAltro } = await supabase
      .from('profili')
      .select('id, nome, cognome, profilo_orario_id')
      .eq('id', searchParams.utente)
      .eq('abilitato_ore_lavoro', true)
      .maybeSingle();
    if (profiloAltro) {
      utenteTarget = {
        id: profiloAltro.id,
        nome: `${profiloAltro.nome} ${profiloAltro.cognome}`.trim(),
        profiloOrarioId: profiloAltro.profilo_orario_id,
      };
      modalitaAdmin = true;
    }
  }

  if (!modalitaAdmin) {
    assicuraAccessoOreLavoro(profilo?.abilitato_ore_lavoro);
  }

  const nomeVisualizzato = profilo?.nome || user.email || '';
  const inizioSettimanaCorrente = lunediSettimana(oggi());
  const lunedi = settimanaOreLavoroRichiesta(searchParams.settimana, oggi());
  const giorni = giorniSettimana(lunedi);
  const domenica = giorni[giorni.length - 1];
  const settimanaPrecedente = sommaGiorni(lunedi, -7);
  const puoAndareAvanti = lunedi < inizioSettimanaCorrente;
  const settimanaSuccessiva = sommaGiorni(lunedi, 7);
  const suffissoUtente = modalitaAdmin ? `&utente=${utenteTarget.id}` : '';

  const [
    profiloOrario,
    { data: righeGiorni, error: erroreGiorni },
    { data: settimana, error: erroreSettimana },
    chiusure,
    { data: movimentiMonteOre },
  ] = await Promise.all([
    recuperaProfiloOrario(supabase, utenteTarget.profiloOrarioId),
    supabase
      .from('ore_lavoro_giorni')
      .select(
        'data, stato, ore_ordinarie, ore_straordinarie, motivo_straordinario, codice_malattia, nota_assenza, updated_at'
      )
      .eq('utente_id', utenteTarget.id)
      .in('data', giorni),
    supabase
      .from('ore_lavoro_settimane')
      .select(
        'confermata_at, ore_dovute, ore_ordinarie_erogate, ore_straordinarie_erogate, straordinario_residuo, decisione_straordinari, decisione_straordinari_at'
      )
      .eq('utente_id', utenteTarget.id)
      .eq('settimana_inizio', lunedi)
      .maybeSingle(),
    chiusurePerPeriodo(supabase, lunedi, domenica),
    // Monte ore (specs/19 - monte-ore.md): tutti i movimenti, per
    // calcolare il saldo esatto (somma di tutte le variazioni, non solo
    // le più recenti) — il componente MonteOre mostra solo gli ultimi
    // allo storico (solo per l'admin, che può anche aggiungerne uno
    // manuale).
    supabase
      .from('monte_ore_movimenti')
      .select('id, tipo, settimana_inizio, variazione, nota, created_at')
      .eq('utente_id', utenteTarget.id)
      .order('created_at', { ascending: false }),
  ]);

  // Se una di queste due query fallisce (es. permission denied per GRANT
  // mancanti, già capitato più volte — vedi lib/auth.ts:requireProfilo)
  // righeGiorni/settimana restano semplicemente vuoti: la pagina degrada
  // (mostra "0 ore"/"non confermata" invece di crashare), ma logghiamo
  // l'errore reale per renderlo diagnosticabile dai log Vercel.
  if (erroreGiorni) {
    console.error(`ore-lavoro: impossibile leggere ore_lavoro_giorni per ${utenteTarget.id}`, erroreGiorni);
  }
  if (erroreSettimana) {
    console.error(`ore-lavoro: impossibile leggere ore_lavoro_settimane per ${utenteTarget.id}`, erroreSettimana);
  }

  const righePerGiorno = new Map((righeGiorni ?? []).map((r) => [r.data, r]));
  // Effetto visibile della conferma (specs/05 - feedback.md): il più
  // recente tra gli `updated_at` dei 7 giorni salvati, l'unico modo di
  // accorgersi del salvataggio quando le ore scritte coincidono con
  // quelle già presenti.
  const ultimoSalvataggio = (righeGiorni ?? []).reduce<string | null>(
    (piuRecente, r) => (!piuRecente || r.updated_at > piuRecente ? r.updated_at : piuRecente),
    null
  );
  const confermata = !!settimana?.confermata_at;
  // L'admin vede sempre i campi modificabili, anche su una settimana
  // già confermata (specs/18): solo il diretto interessato la vede in
  // sola lettura una volta confermata.
  const soloLettura = confermata && !modalitaAdmin;

  const righe = giorni.map((data) => {
    const salvata = righePerGiorno.get(data);
    return {
      data,
      etichetta: formattaGiornoSettimana(data),
      dataBreve: formattaDataBreve(data),
      // Solo informativo: il registro ore di lavoro non blocca la
      // scrittura nei giorni di chiusura scolastica (specs/18, specs/53
      // — a differenza di presenze/pasti, il personale può lavorare
      // anche quando l'asilo non è operativo).
      chiuso: isGiornoChiuso(data, chiusure),
      messaggioChiuso: notaGiornoChiusoOreLavoro(data, chiusure),
      // Un giorno non ancora salvato è "Chiusura" se l'asilo è chiuso,
      // altrimenti "Lavorativo" (specs/18).
      stato: (salvata?.stato ?? statoPredefinitoGiornoOreLavoro(data, chiusure)) as StatoGiornoOreLavoro,
      orePreviste: profiloOrario === null ? null : oreOrdinariePreviste(profiloOrario, data),
      oreOrdinarie: salvata
        ? salvata.ore_ordinarie
        : statoPredefinitoGiornoOreLavoro(data, chiusure) === 'lavorativo'
          ? oreOrdinariePreviste(profiloOrario, data)
          : 0,
      oreStraordinarie: salvata?.ore_straordinarie ?? 0,
      motivoStraordinario: salvata?.motivo_straordinario ?? '',
      // Differenza rispetto al previsto (specs/18): stessa formula del
      // delta di report e monte ore, quindi compatibile con lo storico.
      // Un giorno malattia/assenza (ore a 0) riparte da 0 se si torna a
      // "Lavorativo", non da -previste.
      differenzaOre:
        salvata && salvata.stato === 'lavorativo'
          ? // Dati storici non a quarti d'ora: mostrati arrotondati (solo
            // in lettura, il dato cambia se si salva la card).
            arrotondaAQuartiDora(
              differenzaGiornoOreLavoro(
                oreOrdinariePreviste(profiloOrario, data),
                Number(salvata.ore_ordinarie),
                Number(salvata.ore_straordinarie)
              )
            )
          : 0,
      codiceMalattia: salvata?.codice_malattia ?? '',
      notaAssenza: salvata?.nota_assenza ?? '',
    };
  });

  // Ore previste e differenza ore della scheda settimanale (specs/18,
  // specs/19): sempre la somma di quanto mostrato nelle card dei giorni
  // (stato iniziale = valori mostrati, che includono i precaricati non
  // ancora salvati), anche per una settimana già confermata e poi
  // corretta dall'admin — non lo snapshot registrato alla conferma, che
  // divergerebbe dalle card (#151). Il riquadro si aggiorna "a vivo" con
  // quanto digitato; l'anteprima dell'effetto sul monte ore (specs/19)
  // compare solo finché la settimana non è confermata.
  const giorniRiepilogo = righe.map((r) => ({
    stato: r.stato as string,
    orePreviste: r.orePreviste ?? 0,
    differenza: r.differenzaOre as number | null,
  }));
  const inizialeLive = Object.fromEntries(righe.map((r, i) => [r.data, giorniRiepilogo[i]]));
  const straordinarioResiduo = confermata ? Number(settimana!.straordinario_residuo) : 0;

  // Calcolo completo mese per mese (specs/19): sempre completo, non dipende
  // dalla settimana mostrata.
  const calcoloMensile = await calcoloMensilePerUtente(supabase, {
    utenteId: utenteTarget.id,
    profiloOrario,
    oggiData: oggi(),
    movimenti: movimentiMonteOre ?? [],
  });

  return (
    <NavHeader nome={nomeVisualizzato} ruolo={ruolo}>
      <SettimanaOreLavoroProvider iniziale={inizialeLive}>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <div>
          <a
            href={modalitaAdmin ? '/admin/ore-lavoro' : '/dashboard'}
            className="text-sm text-stone-600 hover:text-stone-900"
          >
            {modalitaAdmin ? '← Torna all\'elenco del personale' : '← Torna alla dashboard'}
          </a>
          <h1 className="mt-2 text-lg font-medium">
            Ore di lavoro{modalitaAdmin && <span className="font-normal text-stone-600"> — {utenteTarget.nome}</span>}
          </h1>
          {!modalitaAdmin && (
            <p className="mt-1">
              <Link href="/dashboard/profilo-orario" className="text-sm text-stone-700 underline hover:text-stone-900">
                Il mio profilo orario
              </Link>
            </p>
          )}
        </div>

        {modalitaAdmin && (
          <SelettoreVistaOreLavoro
            vista="settimana"
            hrefMese={`/dashboard/ore-lavoro/mese?mese=${meseDaData(lunedi)}&utente=${utenteTarget.id}`}
            hrefSettimana={`/dashboard/ore-lavoro?settimana=${lunedi}&utente=${utenteTarget.id}`}
          />
        )}

        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <Link
            href={`/dashboard/ore-lavoro?settimana=${settimanaPrecedente}${suffissoUtente}`}
            aria-label="Settimana precedente"
            className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
          >
            ←
          </Link>
          <span className="text-sm font-medium text-amber-900">{formattaIntervalloItaliano(lunedi, domenica)}</span>
          {puoAndareAvanti && (
            <Link
              href={`/dashboard/ore-lavoro?settimana=${settimanaSuccessiva}${suffissoUtente}`}
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
            {modalitaAdmin && ' Puoi comunque correggerla qui sotto.'}
          </p>
        )}

        {soloLettura ? (
          <div className="space-y-2">
            {righe.map((r) => (
              <div key={r.data} className={`rounded-xl border p-3 shadow-sm ${classeCardOreLavoro(r.stato === 'lavorativo' ? r.differenzaOre : null)}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {r.etichetta} <span className="font-normal text-stone-600">{r.dataBreve}</span>
                  </span>
                  <span className="text-sm text-stone-600">{ETICHETTE_STATO_ORE_LAVORO[r.stato]}</span>
                </div>
                {r.chiuso && <p className="mt-1 text-xs text-stone-500">{r.messaggioChiuso}</p>}
                {r.stato === 'lavorativo' && (
                  <div className="mt-2 space-y-3">
                    <OrePreviste orePreviste={r.orePreviste} />
                    <p className="text-sm text-stone-700">
                      Differenza ore: <strong>{formattaOreConSegno(r.differenzaOre)}h</strong>
                    </p>
                    {r.differenzaOre !== 0 && r.motivoStraordinario && (
                      <p className="text-sm text-stone-700">Motivo: {r.motivoStraordinario}</p>
                    )}
                    <TotaleOreErogate
                      etichettaGiorno={r.etichetta}
                      totale={totaleOreErogate(r.orePreviste ?? 0, r.differenzaOre)}
                      differenza={r.differenzaOre}
                    />
                  </div>
                )}
                {r.stato === 'malattia' && (
                  <p className="mt-1 text-sm text-stone-600">Codice malattia: {r.codiceMalattia}</p>
                )}
                {r.stato === 'assenza' && <p className="mt-1 text-sm text-stone-600">Nota: {r.notaAssenza}</p>}
                {isStatoNeutroOreLavoro(r.stato) && <p className="mt-1 text-sm text-stone-600">{TESTO_GIORNO_DI_VACANZA}</p>}
              </div>
            ))}
          </div>
        ) : (
          <FormConEsito action={salvaSettimanaOreLavoro} className="space-y-2">
            <input type="hidden" name="settimana_inizio" value={lunedi} />
            <input type="hidden" name="utente_id" value={utenteTarget.id} />
            {righe.map((r) => (
              <RigaOreLavoro
                key={r.data}
                etichettaGiorno={r.etichetta}
                dataBreve={r.dataBreve}
                messaggioChiuso={r.chiuso ? r.messaggioChiuso : null}
                orePreviste={r.orePreviste}
                valori={{
                  data: r.data,
                  stato: r.stato,
                  differenzaOre: r.differenzaOre,
                  motivo: r.motivoStraordinario,
                  codiceMalattia: r.codiceMalattia,
                  notaAssenza: r.notaAssenza,
                }}
              />
            ))}
            <PulsanteInvio className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
              Salva modifiche
            </PulsanteInvio>
            {ultimoSalvataggio && (
              <p className="text-xs text-stone-600">
                Ultimo salvataggio: {formattaDataOraItaliana(ultimoSalvataggio).replace('_', ' alle ')}
              </p>
            )}
          </FormConEsito>
        )}

        <RiepilogoSettimanaOreLavoro />

        {confermata && (
          <StraordinarioResiduo
            straordinarioResiduo={straordinarioResiduo}
            decisione={settimana!.decisione_straordinari}
            decisioneAt={settimana!.decisione_straordinari_at}
            modalitaAdmin={modalitaAdmin}
            utenteId={utenteTarget.id}
            settimanaInizio={lunedi}
            decidi={decidiStraordinarioResiduo}
          />
        )}

        <MonteOre
          saldo={saldoMonteOre(movimentiMonteOre ?? [])}
          movimenti={movimentiMonteOre ?? []}
          modalitaAdmin={modalitaAdmin}
          utenteId={utenteTarget.id}
          aggiungiMovimento={aggiungiMovimentoMonteOre}
          modificaMovimento={modificaMovimentoMonteOre}
          eliminaMovimento={eliminaMovimentoMonteOre}
        />

        <CalcoloMensileMonteOre righe={calcoloMensile} />

        {confermata && modalitaAdmin && (
          <ConfermaAzione
            azione={riapriSettimanaOreLavoro}
            campiNascosti={{ settimana_inizio: lunedi, utente_id: utenteTarget.id }}
            etichetta="Riapri settimana"
            messaggioConferma={`Riaprire la settimana per ${utenteTarget.nome}? Potrà di nuovo modificare le ore e dovrà riconfermarla.`}
            etichettaConferma="Sì, riapri"
            tono="neutro"
          />
        )}

        {!confermata && (
          <ConfermaAzione
            azione={confermaSettimanaOreLavoro}
            campiNascosti={{ settimana_inizio: lunedi, utente_id: utenteTarget.id }}
            etichetta="Conferma settimana"
            messaggioConferma={
              modalitaAdmin
                ? `Confermi le ore di questa settimana per ${utenteTarget.nome}?`
                : 'Confermi le ore di questa settimana? Da questo momento non potrai più modificarle autonomamente.'
            }
            tono="neutro"
          />
        )}
      </main>
      </SettimanaOreLavoroProvider>
    </NavHeader>
  );
}
