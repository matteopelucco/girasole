import { createAdminClient } from '@/lib/supabase/admin';
import {
  lunediSettimana,
  sommaGiorni,
  giorniSettimana,
  formattaDataItaliana,
  formattaGiornoSettimana,
  formattaIntervalloItaliano,
  primoGiornoMese,
  ultimoGiornoMese,
} from '@/lib/date';
import { totaliSettimanaOreLavoro, ETICHETTE_STATO_ORE_LAVORO, type StatoGiornoOreLavoro } from '@/lib/oreLavoro';
import { saldoMonteOre, saldiPerUtente } from '@/lib/monteOre';
import { recuperaProfiloOrarioConNome } from '@/lib/profiliOrari';
import { righeOSollevaErrore, STILE_TABELLA, STILE_CELLA, STILE_CELLA_NUMERO } from '@/lib/reportPresenze';
import type { PersonaPdfOreLavoro, GiornoPdfOreLavoro } from '@/lib/pdfOreLavoro';

// Aggregazione delle ore di lavoro del personale per il report notturno
// (specs/52 - report-email-automatico.md, specs/19 - monte-ore.md): il
// riepilogo settimanale nel corpo dell'email e il PDF mensile allegato.
// Usa la service_role key (bypassa la RLS), come lib/reportPresenze.ts:
// il cron non ha una sessione utente e deve vedere tutto il personale
// abilitato, non solo il proprio.

type PersonaAbilitata = { id: string; nome: string; cognome: string; profilo_orario_id: string | null };

async function personaleAbilitatoOreLavoro(supabase: ReturnType<typeof createAdminClient>): Promise<PersonaAbilitata[]> {
  const r = await supabase
    .from('profili')
    .select('id, nome, cognome, profilo_orario_id')
    .eq('abilitato_ore_lavoro', true)
    .order('cognome');
  return righeOSollevaErrore(r, 'lettura personale abilitato al report ore');
}

// Corpo HTML del riepilogo ore della settimana corrente per il report
// notturno (specs/52, scenario "riepilogo delle ore di lavoro del
// personale nel corpo dell'email"): una riga per persona abilitata, con
// le ore registrate dal lunedì fino a `finoAData` incluso ("a
// tutt'oggi", stesso principio del settimanale/mensile di presenze) e
// il saldo di monte ore attuale.
export async function generaRiepilogoOreLavoroSettimanaHtml(finoAData: string): Promise<string> {
  const supabase = createAdminClient();
  const personale = await personaleAbilitatoOreLavoro(supabase);

  const lunedi = lunediSettimana(finoAData);
  const titolo = `Ore di lavoro — settimana ${formattaIntervalloItaliano(lunedi, finoAData)}`;

  if (!personale.length) {
    return `<h2>${titolo}</h2><p>Nessun membro del personale è abilitato al report ore.</p>`;
  }

  const idPersonale = personale.map((p) => p.id);
  const [rGiorni, rMovimenti] = await Promise.all([
    supabase
      .from('ore_lavoro_giorni')
      .select('utente_id, ore_ordinarie, ore_straordinarie')
      .in('utente_id', idPersonale)
      .gte('data', lunedi)
      .lte('data', finoAData),
    supabase.from('monte_ore_movimenti').select('utente_id, variazione').in('utente_id', idPersonale),
  ]);
  const giorni = righeOSollevaErrore(rGiorni, 'lettura ore di lavoro della settimana');
  const movimenti = righeOSollevaErrore(rMovimenti, 'lettura movimenti monte ore');
  const saldi = saldiPerUtente(movimenti);

  const righe = personale
    .map((persona) => {
      const totali = totaliSettimanaOreLavoro(
        giorni
          .filter((g) => g.utente_id === persona.id)
          .map((g) => ({ oreOrdinarie: g.ore_ordinarie, oreStraordinarie: g.ore_straordinarie }))
      );
      const saldo = saldi.get(persona.id) ?? 0;
      return (
        `<tr><td style="${STILE_CELLA}">${persona.nome} ${persona.cognome}</td>` +
        `<td style="${STILE_CELLA_NUMERO}">${totali.ordinarie}</td>` +
        `<td style="${STILE_CELLA_NUMERO}">${totali.straordinarie}</td>` +
        `<td style="${STILE_CELLA_NUMERO}">${totali.totale}</td>` +
        `<td style="${STILE_CELLA_NUMERO}">${saldo}</td></tr>`
      );
    })
    .join('');

  return (
    `<h2>${titolo}</h2>` +
    `<table style="${STILE_TABELLA}"><thead><tr>` +
    `<th style="${STILE_CELLA}">Nome</th>` +
    `<th style="${STILE_CELLA_NUMERO}">Ore ordinarie</th>` +
    `<th style="${STILE_CELLA_NUMERO}">Ore straordinarie</th>` +
    `<th style="${STILE_CELLA_NUMERO}">Totale</th>` +
    `<th style="${STILE_CELLA_NUMERO}">Monte ore</th>` +
    `</tr></thead><tbody>${righe}</tbody></table>`
  );
}

// Dati per il PDF mensile delle ore di lavoro (specs/52, scenario "PDF
// mensile delle ore del personale in allegato"): una voce per persona
// abilitata, limitata alle settimane del mese già confermate (specs/18).
// `mese` nel formato 'YYYY-MM' (lib/date.ts).
export async function personePdfOreLavoroMensile(mese: string): Promise<PersonaPdfOreLavoro[]> {
  const supabase = createAdminClient();
  const personale = await personaleAbilitatoOreLavoro(supabase);
  if (!personale.length) return [];

  const inizioMese = primoGiornoMese(mese);
  const fineMese = ultimoGiornoMese(mese);

  const settimane: string[] = [];
  for (let lunedi = lunediSettimana(inizioMese); lunedi <= fineMese; lunedi = sommaGiorni(lunedi, 7)) {
    settimane.push(lunedi);
  }

  const idPersonale = personale.map((p) => p.id);
  const [rConfermate, rMovimenti] = await Promise.all([
    supabase
      .from('ore_lavoro_settimane')
      .select('utente_id, settimana_inizio')
      .in('utente_id', idPersonale)
      .in('settimana_inizio', settimane),
    supabase.from('monte_ore_movimenti').select('utente_id, variazione, tipo, settimana_inizio').in('utente_id', idPersonale),
  ]);
  const confermate = righeOSollevaErrore(rConfermate, 'lettura settimane ore di lavoro confermate');
  const movimenti = righeOSollevaErrore(rMovimenti, 'lettura movimenti monte ore');

  const confermateSet = new Set(confermate.map((c) => `${c.utente_id}|${c.settimana_inizio}`));
  const saldiAttuali = saldiPerUtente(movimenti);

  const risultati: PersonaPdfOreLavoro[] = [];
  for (const persona of personale) {
    const settimaneConfermate = settimane.filter((s) => confermateSet.has(`${persona.id}|${s}`));
    const settimaneNonConfermate = settimane.filter((s) => !confermateSet.has(`${persona.id}|${s}`));

    let giorniPersona: GiornoPdfOreLavoro[] = [];
    if (settimaneConfermate.length) {
      const dateSettimane = settimaneConfermate.flatMap((s) => giorniSettimana(s));
      const { data: righeGiorni } = await supabase
        .from('ore_lavoro_giorni')
        .select('data, stato, ore_ordinarie, ore_straordinarie, motivo_straordinario, codice_malattia, nota_assenza')
        .eq('utente_id', persona.id)
        .in('data', dateSettimane)
        .order('data', { ascending: true });

      giorniPersona = (righeGiorni ?? [])
        .filter((r) => r.data >= inizioMese && r.data <= fineMese)
        .map((r) => ({
          data: formattaDataItaliana(r.data),
          giornoSettimana: formattaGiornoSettimana(r.data),
          stato: ETICHETTE_STATO_ORE_LAVORO[r.stato as StatoGiornoOreLavoro] ?? r.stato,
          oreOrdinarie: String(r.ore_ordinarie),
          oreStraordinarie: String(r.ore_straordinarie),
          dettaglio: r.motivo_straordinario || r.codice_malattia || r.nota_assenza || '',
        }));
    }

    const profiloOrario = await recuperaProfiloOrarioConNome(supabase, persona.profilo_orario_id);
    const variazioneMese = saldoMonteOre(
      movimenti.filter(
        (m) => m.utente_id === persona.id && m.tipo === 'settimanale' && settimane.includes(m.settimana_inizio as string)
      )
    );

    risultati.push({
      nome: `${persona.nome} ${persona.cognome}`.trim(),
      profiloOrarioNome: profiloOrario?.nome ?? null,
      profiloOrarioDettaglio: profiloOrario
        ? `Lun ${profiloOrario.ore_lunedi}h · Mar ${profiloOrario.ore_martedi}h · Mer ${profiloOrario.ore_mercoledi}h · Gio ${profiloOrario.ore_giovedi}h · Ven ${profiloOrario.ore_venerdi}h`
        : null,
      giorni: giorniPersona,
      settimaneNonConfermate: settimaneNonConfermate.map((s) => formattaIntervalloItaliano(s, sommaGiorni(s, 6))),
      variazioneMese,
      saldoAttuale: saldiAttuali.get(persona.id) ?? 0,
    });
  }

  return risultati;
}
