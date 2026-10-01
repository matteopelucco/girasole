import { createAdminClient } from '@/lib/supabase/admin';
import { lunediSettimana, formattaIntervalloItaliano, primoGiornoMese, ultimoGiornoMese, formattaMeseItaliano, oggi } from '@/lib/date';
import { totaliSettimanaOreLavoro } from '@/lib/oreLavoro';
import { saldiPerUtente, saldoMonteOreBreve } from '@/lib/monteOre';
import { chiusurePerPeriodo } from '@/lib/calendarioScolastico';
import { righeMeseOreLavoro, settimaneDelMese } from '@/lib/oreLavoroMese';
import { personaPdfOreLavoro, nomeFilePdfOreLavoroPersona } from '@/lib/pdfOreLavoroDati';
import { recuperaProfiloOrarioConNome } from '@/lib/profiliOrari';
import { righeOSollevaErrore, STILE_TABELLA, STILE_CELLA, STILE_CELLA_NUMERO } from '@/lib/reportPresenze';
import {
  generaPdfOreLavoroMensile,
  nomeFilePdfOreLavoroMensile,
  type PersonaPdfOreLavoro,
} from '@/lib/pdfOreLavoro';

// Aggregazione delle ore di lavoro del personale per il report notturno
// (specs/52 - report-email-automatico.md, specs/19 - monte-ore.md): il
// riepilogo settimanale nel corpo dell'email e il PDF mensile allegato.
// Usa la service_role key (bypassa la RLS), come lib/reportPresenze.ts:
// il cron non ha una sessione utente e deve vedere tutto il personale
// abilitato, non solo il proprio.

type PersonaAbilitata = { id: string; nome: string; cognome: string; profilo_orario_id: string | null };

// `utenteId` (opzionale) restringe a una sola persona: è il PDF del singolo
// dipendente, che resta vuoto se quella persona non è abilitata.
async function personaleAbilitatoOreLavoro(
  supabase: ReturnType<typeof createAdminClient>,
  utenteId?: string
): Promise<PersonaAbilitata[]> {
  let query = supabase
    .from('profili')
    .select('id, nome, cognome, profilo_orario_id')
    .eq('abilitato_ore_lavoro', true)
    .order('cognome');
  if (utenteId) query = query.eq('id', utenteId);
  return righeOSollevaErrore(await query, 'lettura personale abilitato al report ore');
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
        `<td style="${STILE_CELLA_NUMERO}">${saldoMonteOreBreve(saldo)}</td></tr>`
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

// PDF mensile delle ore di lavoro, completo di nome file (specs/52,
// specs/18): l'unica fonte sia per l'allegato del cron notturno sia per i
// download dell'admin. `mese` nel formato 'AAAA-MM'. Usa la service_role
// key: chi chiama deve aver già verificato il ruolo (il cron con il suo
// secret, le route di download con requireAdmin).
type PdfOreLavoro = { filename: string; content: Uint8Array };

// Tutto il personale abilitato: allegato del cron e download da
// `/admin/ore-lavoro/pdf`.
export async function pdfOreLavoroMensile(mese: string, generatoIl: Date): Promise<PdfOreLavoro> {
  const personale = await personaleAbilitatoOreLavoro(createAdminClient());
  return {
    filename: nomeFilePdfOreLavoroMensile(mese),
    content: await pdfDelPersonale(mese, generatoIl, personale),
  };
}

// Una sola persona, dalla sua vista mensile (`/admin/ore-lavoro/pdf?utente=`):
// stesso codice e stesso layout del PDF del personale. null se la persona
// non esiste o non è abilitata al report ore.
export async function pdfOreLavoroMensileDipendente(
  mese: string,
  generatoIl: Date,
  utenteId: string
): Promise<PdfOreLavoro | null> {
  const [persona] = await personaleAbilitatoOreLavoro(createAdminClient(), utenteId);
  if (!persona) return null;
  return {
    filename: nomeFilePdfOreLavoroPersona(mese, persona.cognome, persona.nome),
    content: await pdfDelPersonale(mese, generatoIl, [persona]),
  };
}

async function pdfDelPersonale(mese: string, generatoIl: Date, personale: PersonaAbilitata[]): Promise<Uint8Array> {
  const persone = await personePdfOreLavoroMensile(mese, personale);
  return generaPdfOreLavoroMensile(formattaMeseItaliano(mese), persone, generatoIl);
}

// Dati per il PDF mensile delle ore di lavoro (specs/52, scenario "PDF
// mensile delle ore del personale in allegato"): una voce per persona con
// gli stessi dati della vista mensile admin (lib/oreLavoroMese.ts), tutti i
// giorni del mese e lo stato di conferma di ogni settimana. `mese` nel
// formato 'YYYY-MM' (lib/date.ts).
async function personePdfOreLavoroMensile(mese: string, personale: PersonaAbilitata[]): Promise<PersonaPdfOreLavoro[]> {
  if (!personale.length) return [];
  const supabase = createAdminClient();

  const inizioMese = primoGiornoMese(mese);
  const fineMese = ultimoGiornoMese(mese);
  const settimane = settimaneDelMese(mese);
  const oggiData = oggi();
  const idPersonale = personale.map((p) => p.id);

  const [rGiorni, rConfermate, rMovimenti, chiusure] = await Promise.all([
    supabase
      .from('ore_lavoro_giorni')
      .select('utente_id, data, stato, ore_ordinarie, ore_straordinarie, motivo_straordinario, codice_malattia, nota_assenza')
      .in('utente_id', idPersonale)
      .gte('data', inizioMese)
      .lte('data', fineMese),
    supabase
      .from('ore_lavoro_settimane')
      .select('utente_id, settimana_inizio')
      .in('utente_id', idPersonale)
      .in('settimana_inizio', settimane),
    supabase.from('monte_ore_movimenti').select('utente_id, variazione').in('utente_id', idPersonale),
    chiusurePerPeriodo(supabase, inizioMese, fineMese),
  ]);
  const giorni = righeOSollevaErrore(rGiorni, 'lettura giorni ore di lavoro');
  const confermate = righeOSollevaErrore(rConfermate, 'lettura settimane ore di lavoro confermate');
  const movimenti = righeOSollevaErrore(rMovimenti, 'lettura movimenti monte ore');

  const confermateSet = new Set(confermate.map((c) => `${c.utente_id}|${c.settimana_inizio}`));
  const saldi = saldiPerUtente(movimenti);

  const risultati: PersonaPdfOreLavoro[] = [];
  for (const persona of personale) {
    const profiloOrario = await recuperaProfiloOrarioConNome(supabase, persona.profilo_orario_id);
    risultati.push(
      personaPdfOreLavoro({
        nome: `${persona.nome} ${persona.cognome}`.trim(),
        profiloOrarioNome: profiloOrario?.nome ?? null,
        profiloOrarioDettaglio: profiloOrario
          ? `Lun ${profiloOrario.ore_lunedi}h · Mar ${profiloOrario.ore_martedi}h · Mer ${profiloOrario.ore_mercoledi}h · Gio ${profiloOrario.ore_giovedi}h · Ven ${profiloOrario.ore_venerdi}h`
          : null,
        righe: righeMeseOreLavoro({
          mese,
          oggiData,
          salvati: giorni.filter((g) => g.utente_id === persona.id),
          profiloOrario,
          chiusure,
        }),
        settimane: settimane.map((lunedi) => ({ lunedi, confermata: confermateSet.has(`${persona.id}|${lunedi}`) })),
        saldoAttuale: saldi.get(persona.id) ?? 0,
      })
    );
  }
  return risultati;
}
