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

// Stato operativo di `data` su TUTTO l'asilo (fa I/O, resta coperta
// solo da e2e — vedi CLAUDE.md, criterio unit test): usata solo dal
// cron per l'email di riepilogo, richiede la service_role key
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
// senza presenza segnata (`idBambiniSegnati`). Funzione pura.
export function sezioniIncompleteDa(
  bambini: { id: string; sezione_id: string | null }[],
  idBambiniSegnati: Iterable<string>
): Set<string> {
  const segnati = new Set(idBambiniSegnati);
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
// statoPersonaleDa già restituisce liste/flag vuoti quando
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

// Presenze e pasti di `data` sulle sezioni dell'utente corrente (tutte le
// sezioni attive per l'admin): la base comune del banner personale e,
// per l'admin, del riepilogo del personale, letta una sola volta per
// entrambi (issue #367).
export type PresenzeOggi = {
  sezioni: SezioneAttiva[];
  idSezioniIncomplete: Set<string>;
  pastiNonConfermati: boolean;
};

// Legge PresenzeOggi (fa I/O, resta coperta solo da e2e) con la sessione
// normale dell'utente, che ha già visibilità RLS sulle proprie sezioni
// (vedi lib/sezioni.ts:sezioniAttiveVisibili) — nessuna service_role key
// necessaria, a differenza di calcolaStatoOperativoGiorno. Bambini e
// pasti si leggono in parallelo; le presenze dipendono dai bambini.
export async function leggiPresenzeOggi(
  supabase: SupabaseClient,
  ruolo: string | null | undefined,
  sezioni: SezioneAttiva[],
  data: string
): Promise<PresenzeOggi> {
  if (!sezioni.length) {
    return { sezioni, idSezioniIncomplete: new Set(), pastiNonConfermati: false };
  }

  const leggiBambiniESegnati = async () => {
    const { data: bambini } = await supabase
      .from('bambini')
      .select('id, sezione_id')
      .eq('attiva', true)
      .in(
        'sezione_id',
        sezioni.map((s) => s.id)
      );
    const elencoBambini = bambini ?? [];
    if (!elencoBambini.length) return new Set<string>();
    const { data: presenze } = await supabase
      .from('presenze')
      .select('bambino_id')
      .eq('data', data)
      .in(
        'bambino_id',
        elencoBambini.map((b) => b.id)
      );
    return sezioniIncompleteDa(
      elencoBambini,
      (presenze ?? []).map((p) => p.bambino_id)
    );
  };

  // I pasti sono un'unica comunicazione per l'intero asilo (specs/16),
  // non per sezione: chiunque abbia accesso a Pasti (maestra o admin,
  // non l'assistente) può segnalarla, indipendentemente da quali
  // bambini abbia nelle proprie sezioni.
  const leggiPastiNonConfermati = async () => {
    if (ruolo === 'assistente') return false;
    const { data: comunicazione } = await supabase
      .from('pasti_comunicati')
      .select('id')
      .eq('data', data)
      .maybeSingle();
    return !comunicazione;
  };

  const [idSezioniIncomplete, pastiNonConfermati] = await Promise.all([
    leggiBambiniESegnati(),
    leggiPastiNonConfermati(),
  ]);
  return { sezioni, idSezioniIncomplete, pastiNonConfermati };
}

// Stato personale dell'utente corrente a partire da PresenzeOggi.
// Funzione pura.
export function statoPersonaleDa(presenze: PresenzeOggi): StatoPersonaleGiorno {
  return {
    sezioniPresenzeIncomplete: presenze.sezioni.filter((s) => presenze.idSezioniIncomplete.has(s.id)),
    pastiNonConfermati: presenze.pastiNonConfermati,
  };
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

// Dati sul personale per il riepilogo read-only dell'admin (specs/07,
// "l'admin vede gli allarmi di tutto il personale"): maestre/assistenti
// (escluso chi guarda), le loro sezioni e chi ha già confermato la
// settimana ore di riferimento.
export type DipendenteBase = {
  id: string;
  nome: string;
  cognome: string;
  ruolo: string;
  abilitato_ore_lavoro: boolean;
};

export type DatiPersonale = {
  dipendenti: DipendenteBase[];
  assegnazioni: { maestraId: string; sezione: (SezioneAttiva & { attiva: boolean }) | null }[];
  idSettimanaConfermata: Set<string>;
};

// Legge DatiPersonale (fa I/O) con la sessione normale dell'admin, che ha
// già visibilità RLS su profili, sezioni e settimane ore di chiunque —
// nessuna service_role key necessaria. Le presenze/pasti NON si leggono
// qui: sono le stesse dell'admin (tutte le sezioni attive), lette una
// volta sola da leggiPresenzeOggi.
// grant-check: authenticated
export async function leggiDatiPersonale(
  supabase: SupabaseClient,
  utenteCorrenteId: string,
  settimanaInizio: string
): Promise<DatiPersonale> {
  const { data: profili } = await supabase
    .from('profili')
    .select('id, nome, cognome, ruolo, abilitato_ore_lavoro')
    .in('ruolo', ['maestra', 'assistente'])
    .neq('id', utenteCorrenteId);
  const dipendenti = (profili ?? []) as DipendenteBase[];
  if (!dipendenti.length) return { dipendenti, assegnazioni: [], idSettimanaConfermata: new Set() };

  const idAbilitati = dipendenti.filter((d) => d.abilitato_ore_lavoro).map((d) => d.id);
  const [{ data: assegnazioni }, confermate] = await Promise.all([
    supabase
      .from('maestre_sezioni')
      .select('maestra_id, sezioni(id, nome, attiva)')
      .in(
        'maestra_id',
        dipendenti.map((d) => d.id)
      ),
    idAbilitati.length
      ? supabase
          .from('ore_lavoro_settimane')
          .select('utente_id')
          .eq('settimana_inizio', settimanaInizio)
          .in('utente_id', idAbilitati)
          .then(({ data }) => data ?? [])
      : Promise.resolve([] as { utente_id: string }[]),
  ]);

  return {
    dipendenti,
    assegnazioni: (assegnazioni ?? []).map((riga) => ({
      maestraId: riga.maestra_id,
      sezione: riga.sezioni as unknown as (SezioneAttiva & { attiva: boolean }) | null,
    })),
    idSettimanaConfermata: new Set(confermate.map((c) => c.utente_id)),
  };
}

// Riepilogo read-only per l'admin: una riga per ciascuna maestra/
// assistente che ha in questo momento almeno un allarme attivo
// (presenze/pasti nelle proprie sezioni, e/o settimana ore non
// confermata). `presenze` è null quando l'allarme presenze/pasti non può
// scattare (prima delle 10:00 o giorno chiuso). Funzione pura.
export function allarmiDipendentiDa(
  personale: DatiPersonale,
  presenze: PresenzeOggi | null,
  settimanaRiferimento: { inizio: string; fine: string }
): AllarmeDipendente[] {
  const sezioniPerUtente = new Map<string, SezioneAttiva[]>();
  for (const { maestraId, sezione } of personale.assegnazioni) {
    if (!sezione?.attiva) continue;
    const elenco = sezioniPerUtente.get(maestraId) ?? [];
    elenco.push({ id: sezione.id, nome: sezione.nome });
    sezioniPerUtente.set(maestraId, elenco);
  }

  const idSezioniIncomplete = presenze?.idSezioniIncomplete ?? new Set<string>();
  const pastiNonConfermatiOggi = !!presenze && presenze.sezioni.length > 0 && presenze.pastiNonConfermati;

  const risultato: AllarmeDipendente[] = [];
  for (const dipendente of personale.dipendenti) {
    const proprieSezioni = sezioniPerUtente.get(dipendente.id) ?? [];
    const sezioniProblematiche = proprieSezioni.filter((s) => idSezioniIncomplete.has(s.id)).map((s) => s.nome);
    const pastiProblema = dipendente.ruolo !== 'assistente' && pastiNonConfermatiOggi && proprieSezioni.length > 0;
    const settimanaProblema = dipendente.abilitato_ore_lavoro && !personale.idSettimanaConfermata.has(dipendente.id);

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
