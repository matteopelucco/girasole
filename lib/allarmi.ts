import type { SupabaseClient } from '@supabase/supabase-js';

// Vero se, nel fuso Europe/Rome, sono le 12:00 o più tardi — soglia
// dell'allarme "presenze/pasti non completati" (specs/07 - allarmi.md).
// Funzione pura: riceve l'istante da controllare invece di leggere
// `new Date()` al suo interno, per restare testabile.
export function dopoMezzogiorno(adesso: Date): boolean {
  const ora = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hourCycle: 'h23' }).format(adesso)
  );
  return ora >= 12;
}

export type StatoOperativoGiorno = {
  // Vero se non ci sono classi/bambini attivi: in quel caso nessuno dei
  // due controlli seguenti ha senso (nulla da segnare).
  nessunDatoAtteso: boolean;
  presenzeIncomplete: boolean;
  pastiNonConfermati: boolean;
};

// Vero se scatta l'allarme "presenze/pasti non completati entro
// mezzogiorno" (specs/07). Funzione pura: chi chiama ha già calcolato
// se il giorno è attivo (specs/53) e lo stato operativo del giorno
// (I/O, vedi calcolaStatoOperativoGiorno sotto).
export function allarmeMezzogiornoAttivo(adesso: Date, giornoAttivo: boolean, stato: StatoOperativoGiorno): boolean {
  if (!giornoAttivo || stato.nessunDatoAtteso) return false;
  if (!dopoMezzogiorno(adesso)) return false;
  return stato.presenzeIncomplete || stato.pastiNonConfermati;
}

// Descrizione testuale di cosa manca, condivisa tra il banner in
// dashboard e il corpo dell'email (specs/07), per non scrivere la
// stessa frase in due posti. Stringa vuota se non manca nulla.
export function descrizioneStatoOperativo(stato: StatoOperativoGiorno): string {
  const parti: string[] = [];
  if (stato.presenzeIncomplete) parti.push('non tutte le presenze sono state segnate');
  if (stato.pastiNonConfermati) parti.push('i pasti non sono stati comunicati a Rojac');
  return parti.join(' e ');
}

// Stato operativo di `data` su TUTTO l'asilo (fa I/O, resta coperta
// solo da e2e — vedi CLAUDE.md, criterio unit test): richiede una
// visibilità cross-sezione che un utente normale non ha via RLS, chi
// chiama deve passare un client con la service_role key (stesso motivo
// già documentato per il report notturno, specs/52).
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

// Vero se `utenteId` ha già confermato la settimana che inizia
// `settimanaInizio` (fa I/O). Usa la sessione normale dell'utente: la
// RLS esistente (ore_lavoro_settimane_select_own_or_admin, specs/18)
// già permette a chiunque di leggere la propria riga, nessun permesso
// nuovo necessario — a differenza di calcolaStatoOperativoGiorno sopra.
export async function settimanaPrecedenteConfermata(
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
// `settimanaInizio` non risulta confermata (fa I/O) — usata solo dal
// cron (specs/07): richiede di leggere tutti gli utenti abilitati,
// serve un client con la service_role key.
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
