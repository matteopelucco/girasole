import type { SupabaseClient } from '@supabase/supabase-js';
import type { SezioneAttiva } from './sezioni';
import { settimanaCorrente, settimanaPrecedente } from './date';

// Soglia oraria (fuso Europe/Rome) dell'allarme "presenze/pasti non
// completati" (specs/07 - allarmi.md): condivisa dal banner personale in
// dashboard e dall'email aggregata inviata dal cron. Funzione pura:
// riceve l'istante da controllare invece di leggere `new Date()` al suo
// interno, per restare testabile.
export function dopoOrarioAllarmePresenzePasti(adesso: Date): boolean {
  const ora = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hourCycle: 'h23' }).format(adesso)
  );
  return ora >= 10;
}

// Vero da venerdì alle 18:00 (fuso Europe/Rome) in poi, e per tutto il
// weekend — la soglia da cui l'allarme "settimana ore non confermata"
// (specs/07) considera scaduta la settimana CORRENTE invece di quella
// precedente (vedi settimanaDiRiferimentoOre sotto).
export function dopoSogliaVenerdiSera(adesso: Date): boolean {
  const parti = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome',
    weekday: 'short',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(adesso);
  const giorno = parti.find((p) => p.type === 'weekday')?.value;
  const ora = Number(parti.find((p) => p.type === 'hour')?.value);

  if (giorno === 'Sat' || giorno === 'Sun') return true;
  if (giorno === 'Fri') return ora >= 18;
  return false;
}

// Settimana (lunedì-domenica) più di recente il cui termine è scaduto
// (specs/07, regola "Settimana di riferimento"): la precedente fino a
// venerdì 18:00, poi la corrente stessa (scadenza anticipata, non un
// vincolo di completezza — la settimana corrente resta comunque
// confermabile con i giorni futuri precaricati dal profilo orario,
// specs/18). Funzione pura.
export function settimanaDiRiferimentoOre(adesso: Date, oggi: string): { inizio: string; fine: string } {
  return dopoSogliaVenerdiSera(adesso) ? settimanaCorrente(oggi) : settimanaPrecedente(oggi);
}

export type StatoOperativoGiorno = {
  // Vero se non ci sono classi/bambini attivi: in quel caso nessuno dei
  // due controlli seguenti ha senso (nulla da segnare).
  nessunDatoAtteso: boolean;
  presenzeIncomplete: boolean;
  pastiNonConfermati: boolean;
};

// Vero se scatta l'allarme email "presenze/pasti non completati",
// aggregato sull'intero asilo (specs/07) — usato solo dal cron, chi
// chiama ha già calcolato se il giorno è attivo (specs/53) e lo stato
// operativo del giorno (I/O, vedi calcolaStatoOperativoGiorno sotto).
export function allarmeAsiloAttivo(adesso: Date, giornoAttivo: boolean, stato: StatoOperativoGiorno): boolean {
  if (!giornoAttivo || stato.nessunDatoAtteso) return false;
  if (!dopoOrarioAllarmePresenzePasti(adesso)) return false;
  return stato.presenzeIncomplete || stato.pastiNonConfermati;
}

// Descrizione testuale di cosa manca, condivisa tra l'email aggregata e
// (in passato) il banner in dashboard (specs/07), per non scrivere la
// stessa frase in due posti. Stringa vuota se non manca nulla.
export function descrizioneStatoOperativo(stato: StatoOperativoGiorno): string {
  const parti: string[] = [];
  if (stato.presenzeIncomplete) parti.push('non tutte le presenze sono state segnate');
  if (stato.pastiNonConfermati) parti.push('i pasti non sono stati comunicati a Rojac');
  return parti.join(' e ');
}

// Stato operativo di `data` su TUTTO l'asilo (fa I/O, resta coperta
// solo da e2e — vedi CLAUDE.md, criterio unit test): usata solo dal
// cron per l'email aggregata, richiede la service_role key
// (`lib/supabase/admin.ts`) perché non ha una sessione utente da cui
// ereditare la RLS.
export async function calcolaStatoOperativoGiorno(supabase: SupabaseClient, data: string): Promise<StatoOperativoGiorno> {
  const { data: sezioni } = await supabase.from('sezioni').select('id').eq('attiva', true);
  const idSezioni = (sezioni ?? []).map((s) => s.id);
  if (!idSezioni.length) {
    return { nessunDatoAtteso: true, presenzeIncomplete: false, pastiNonConfermati: false };
  }

  const { data: bambini } = await supabase.from('bambini').select('id').eq('attiva', true).in('sezione_id', idSezioni);
  const idBambini = (bambini ?? []).map((b) => b.id);
  if (!idBambini.length) {
    return { nessunDatoAtteso: true, presenzeIncomplete: false, pastiNonConfermati: false };
  }

  const [{ data: presenze }, { data: comunicazione }] = await Promise.all([
    supabase.from('presenze').select('bambino_id').eq('data', data).in('bambino_id', idBambini),
    supabase.from('pasti_comunicati').select('id').eq('data', data).maybeSingle(),
  ]);

  const segnati = new Set((presenze ?? []).map((p) => p.bambino_id));
  const presenzeIncomplete = idBambini.some((id) => !segnati.has(id));

  return { nessunDatoAtteso: false, presenzeIncomplete, pastiNonConfermati: !comunicazione };
}

// Insieme degli id sezione che hanno almeno un bambino (tra `bambini`)
// senza presenza segnata per `data` — usata sia da
// calcolaStatoPersonaleGiorno (le sezioni dell'utente corrente) sia da
// allarmiPerDipendenti (tutte le sezioni attive, per il riepilogo
// dell'admin), per non ripetere la stessa query (CLAUDE.md, jscpd).
async function sezioniConPresenzeIncomplete(
  supabase: SupabaseClient,
  bambini: { id: string; sezione_id: string | null }[],
  data: string
): Promise<Set<string>> {
  if (!bambini.length) return new Set();
  const idBambini = bambini.map((b) => b.id);
  const { data: presenze } = await supabase
    .from('presenze')
    .select('bambino_id')
    .eq('data', data)
    .in('bambino_id', idBambini);
  const segnati = new Set((presenze ?? []).map((p) => p.bambino_id));
  return new Set(bambini.filter((b) => !segnati.has(b.id)).map((b) => b.sezione_id as string));
}

export type StatoPersonaleGiorno = {
  // Solo le sezioni dell'utente corrente (tutte le sezioni attive per
  // l'admin) che hanno almeno un bambino senza presenza segnata oggi.
  sezioniPresenzeIncomplete: SezioneAttiva[];
  pastiNonConfermati: boolean;
};

// Vero se scatta il banner personale "presenze/pasti non ancora
// segnati" (specs/07) per l'utente corrente — a differenza di
// allarmeAsiloAttivo, non richiede "nessunDatoAtteso" perché
// calcolaStatoPersonaleGiorno già restituisce liste/flag vuoti quando
// non c'è nulla da segnare.
export function allarmePersonalePresenzePastiAttivo(
  adesso: Date,
  giornoAttivo: boolean,
  stato: StatoPersonaleGiorno
): boolean {
  if (!giornoAttivo) return false;
  if (!dopoOrarioAllarmePresenzePasti(adesso)) return false;
  return stato.sezioniPresenzeIncomplete.length > 0 || stato.pastiNonConfermati;
}

// Stato personale di `data` per l'utente corrente (fa I/O, resta
// coperta solo da e2e): usa la sessione normale dell'utente, che ha già
// visibilità RLS sulle proprie sezioni (tutte le sezioni attive per
// l'admin, vedi lib/sezioni.ts:sezioniAttiveVisibili) — nessuna
// service_role key necessaria, a differenza di calcolaStatoOperativoGiorno.
export async function calcolaStatoPersonaleGiorno(
  supabase: SupabaseClient,
  ruolo: string | null | undefined,
  sezioni: SezioneAttiva[],
  data: string
): Promise<StatoPersonaleGiorno> {
  if (!sezioni.length) {
    return { sezioniPresenzeIncomplete: [], pastiNonConfermati: false };
  }

  const idSezioni = sezioni.map((s) => s.id);
  const { data: bambini } = await supabase
    .from('bambini')
    .select('id, sezione_id')
    .eq('attiva', true)
    .in('sezione_id', idSezioni);
  const elencoBambini = bambini ?? [];

  const idSezioniIncomplete = await sezioniConPresenzeIncomplete(supabase, elencoBambini, data);
  const sezioniPresenzeIncomplete = sezioni.filter((s) => idSezioniIncomplete.has(s.id));

  // I pasti sono un'unica comunicazione per l'intero asilo (specs/16),
  // non per sezione: chiunque abbia accesso a Pasti (maestra o admin,
  // non l'assistente) può segnalarla, indipendentemente da quali
  // bambini abbia nelle proprie sezioni.
  let pastiNonConfermati = false;
  if (ruolo !== 'assistente') {
    const { data: comunicazione } = await supabase
      .from('pasti_comunicati')
      .select('id')
      .eq('data', data)
      .maybeSingle();
    pastiNonConfermati = !comunicazione;
  }

  return { sezioniPresenzeIncomplete, pastiNonConfermati };
}

// Vero se `utenteId` ha già confermato la settimana che inizia
// `settimanaInizio` (fa I/O). Usa la sessione normale dell'utente: la
// RLS esistente (ore_lavoro_settimane_select_own_or_admin, specs/18)
// già permette a chiunque di leggere la propria riga (o all'admin di
// leggerle tutte), nessun permesso nuovo necessario.
export async function settimanaConfermata(
  supabase: SupabaseClient,
  utenteId: string,
  settimanaInizio: string
): Promise<boolean> {
  const { data } = await supabase
    .from('ore_lavoro_settimane')
    .select('id')
    .eq('utente_id', utenteId)
    .eq('settimana_inizio', settimanaInizio)
    .maybeSingle();
  return !!data;
}

export type UtenteSettimanaNonConfermata = { utenteId: string; nome: string; cognome: string; email: string };

// Tutti gli utenti abilitati al report ore la cui settimana
// `settimanaInizio` non risulta confermata (fa I/O) — usata dal cron
// (specs/07, con la service_role key) e dal riepilogo dell'admin in
// dashboard (con la sua sessione normale, che vede già tutti via RLS).
export async function utentiConSettimanaNonConfermata(
  supabase: SupabaseClient,
  settimanaInizio: string
): Promise<UtenteSettimanaNonConfermata[]> {
  const { data: abilitati } = await supabase
    .from('profili')
    .select('id, nome, cognome, email')
    .eq('abilitato_ore_lavoro', true);
  if (!abilitati?.length) return [];

  const idUtenti = abilitati.map((u) => u.id);
  const { data: confermate } = await supabase
    .from('ore_lavoro_settimane')
    .select('utente_id')
    .eq('settimana_inizio', settimanaInizio)
    .in('utente_id', idUtenti);
  const confermati = new Set((confermate ?? []).map((c) => c.utente_id));

  return abilitati
    .filter((u) => !confermati.has(u.id))
    .map((u) => ({ utenteId: u.id, nome: u.nome, cognome: u.cognome, email: u.email }));
}

export type AllarmeDipendente = {
  utenteId: string;
  nome: string;
  cognome: string;
  sezioniPresenzeIncomplete: string[];
  pastiNonConfermati: boolean;
  settimanaOreNonConfermata: { inizio: string; fine: string } | null;
};

// Riepilogo read-only per l'admin (specs/07, "l'admin vede gli allarmi
// di tutto il personale"): un elenco con una riga per ciascuna
// maestra/assistente che ha in questo momento almeno un allarme attivo
// (presenze/pasti nelle proprie sezioni, e/o settimana ore non
// confermata). Fa I/O con la sessione normale dell'admin, che ha già
// visibilità RLS su tutte le sezioni/bambini/presenze/pasti/settimane
// ore di chiunque — nessuna service_role key necessaria.
export async function allarmiPerDipendenti(
  supabase: SupabaseClient,
  data: string,
  giornoAttivo: boolean,
  adesso: Date,
  utenteCorrenteId: string
): Promise<AllarmeDipendente[]> {
  const { data: profili } = await supabase
    .from('profili')
    .select('id, nome, cognome, ruolo, abilitato_ore_lavoro')
    .in('ruolo', ['maestra', 'assistente'])
    .neq('id', utenteCorrenteId);
  const dipendenti = profili ?? [];
  if (!dipendenti.length) return [];

  const idDipendenti = dipendenti.map((d) => d.id);
  const { data: assegnazioni } = await supabase
    .from('maestre_sezioni')
    .select('maestra_id, sezioni(id, nome, attiva)')
    .in('maestra_id', idDipendenti);

  const sezioniPerUtente = new Map<string, SezioneAttiva[]>();
  for (const riga of assegnazioni ?? []) {
    const sezione = riga.sezioni as unknown as (SezioneAttiva & { attiva: boolean }) | null;
    if (!sezione?.attiva) continue;
    const elenco = sezioniPerUtente.get(riga.maestra_id) ?? [];
    elenco.push({ id: sezione.id, nome: sezione.nome });
    sezioniPerUtente.set(riga.maestra_id, elenco);
  }

  // Sezioni con presenze incomplete a livello di intero asilo, calcolate
  // una sola volta e poi filtrate per dipendente (evita una query per
  // persona).
  let idSezioniIncomplete = new Set<string>();
  let pastiNonConfermatiOggi = false;
  if (giornoAttivo && dopoOrarioAllarmePresenzePasti(adesso)) {
    const { data: sezioniAttive } = await supabase.from('sezioni').select('id').eq('attiva', true);
    const idSezioni = (sezioniAttive ?? []).map((s) => s.id);
    if (idSezioni.length) {
      const { data: bambini } = await supabase
        .from('bambini')
        .select('id, sezione_id')
        .eq('attiva', true)
        .in('sezione_id', idSezioni);
      idSezioniIncomplete = await sezioniConPresenzeIncomplete(supabase, bambini ?? [], data);
      const { data: comunicazione } = await supabase
        .from('pasti_comunicati')
        .select('id')
        .eq('data', data)
        .maybeSingle();
      pastiNonConfermatiOggi = !comunicazione;
    }
  }

  const settimanaRiferimento = settimanaDiRiferimentoOre(adesso, data);
  const idAbilitati = dipendenti.filter((d) => d.abilitato_ore_lavoro).map((d) => d.id);
  const idSettimanaNonConfermata = new Set<string>();
  if (idAbilitati.length) {
    const { data: confermate } = await supabase
      .from('ore_lavoro_settimane')
      .select('utente_id')
      .eq('settimana_inizio', settimanaRiferimento.inizio)
      .in('utente_id', idAbilitati);
    const confermati = new Set((confermate ?? []).map((c) => c.utente_id));
    for (const id of idAbilitati) {
      if (!confermati.has(id)) idSettimanaNonConfermata.add(id);
    }
  }

  const risultato: AllarmeDipendente[] = [];
  for (const dipendente of dipendenti) {
    const proprieSezioni = sezioniPerUtente.get(dipendente.id) ?? [];
    const sezioniProblematiche = proprieSezioni.filter((s) => idSezioniIncomplete.has(s.id)).map((s) => s.nome);
    const pastiProblema = dipendente.ruolo !== 'assistente' && pastiNonConfermatiOggi && proprieSezioni.length > 0;
    const settimanaProblema = idSettimanaNonConfermata.has(dipendente.id);

    if (!sezioniProblematiche.length && !pastiProblema && !settimanaProblema) continue;

    risultato.push({
      utenteId: dipendente.id,
      nome: dipendente.nome,
      cognome: dipendente.cognome,
      sezioniPresenzeIncomplete: sezioniProblematiche,
      pastiNonConfermati: pastiProblema,
      settimanaOreNonConfermata: settimanaProblema ? settimanaRiferimento : null,
    });
  }
  return risultato;
}
