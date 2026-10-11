import type { SupabaseClient } from '@supabase/supabase-js';
import { chiusurePerPeriodo, type GiornoChiusura } from './calendarioScolastico';
import { giorniAperturaMese } from './comunicazioneRetta';
import { meseDaData, primoGiornoMese, ultimoGiornoMese } from './date';

// Allarme "rette non comunicate" (specs/07 - allarmi.md, specs/56): dal
// giorno GIORNO_ALLARME_RETTE del mese in poi, se a un bambino a cui si può
// comunicare la retta manca la comunicazione del mese corrente, l'admin
// viene avvisato (pagina Allarmi, campanella, email di riepilogo del cron). Le funzioni pure ricevono sempre la data dall'esterno (niente
// `new Date()` qui dentro), per restare testabili.

// Giorno del mese (incluso) da cui scatta l'allarme: fisso, si cambia qui.
export const GIORNO_ALLARME_RETTE = 3;

export type BambinoRetta = {
  id: string;
  nome: string;
  cognome: string;
  // Nome della sezione, null se il bambino non ne ha una.
  sezione: string | null;
};

// Vero se in `mese` ("YYYY-MM") non c'è nessun giorno di apertura
// (weekend e chiusure registrate esclusi, specs/53): in quel caso la
// retta non si comunica e l'allarme non ha senso.
export function meseInteramenteChiuso(mese: string, chiusure: GiornoChiusura[]): boolean {
  return giorniAperturaMese(mese, chiusure) === 0;
}

// Vero se, alla data `oggi` ("YYYY-MM-DD", fuso Europe/Rome), ha senso
// cercare i bambini senza comunicazione: dal giorno 3 incluso e solo se il
// mese corrente non è interamente chiuso. `chiusure` sono quelle che
// toccano il mese di `oggi`.
export function allarmeRetteDaControllare(oggi: string, chiusure: GiornoChiusura[]): boolean {
  const giorno = Number(oggi.slice(8, 10));
  if (giorno < GIORNO_ALLARME_RETTE) return false;
  return !meseInteramenteChiuso(meseDaData(oggi), chiusure);
}

type BambinoAttivo = { id: string; nome: string; cognome: string; sezione_id: string | null };

// I bambini a cui manca la comunicazione: gli stessi che la tabella
// "Rette" propone da inviare (attivi, con email di promemoria
// valorizzata — un bambino senza email non riceve mai la comunicazione,
// contarlo non spegnerebbe mai l'allarme) e che non hanno una
// comunicazione registrata per il mese. `bambini` sono già solo quelli
// attivi. Ordinati per cognome e nome.
export function bambiniRetteNonComunicate(parametri: {
  bambini: BambinoAttivo[];
  sezioni: { id: string; nome: string }[];
  costi: { bambino_id: string; email_promemoria: string | null }[];
  idComunicati: Iterable<string>;
}): BambinoRetta[] {
  const comunicati = new Set(parametri.idComunicati);
  const conEmail = new Set(
    parametri.costi.filter((c) => c.email_promemoria?.trim()).map((c) => c.bambino_id)
  );
  const nomeSezione = new Map(parametri.sezioni.map((s) => [s.id, s.nome]));

  return parametri.bambini
    .filter((b) => conEmail.has(b.id) && !comunicati.has(b.id))
    .map((b) => ({
      id: b.id,
      nome: b.nome,
      cognome: b.cognome,
      sezione: (b.sezione_id && nomeSezione.get(b.sezione_id)) || null,
    }))
    .sort((a, b) => `${a.cognome} ${a.nome}`.localeCompare(`${b.cognome} ${b.nome}`, 'it'));
}

// "Nome Cognome (Sezione)": come si vede nella pagina Allarmi. Testo
// semplice, da non usare in HTML senza escape.
export function descrizioneBambinoRetta(bambino: BambinoRetta): string {
  return `${bambino.nome} ${bambino.cognome} (${bambino.sezione ?? 'Senza sezione'})`;
}

// Bambini a cui manca la comunicazione della retta del mese di `oggi`
// (fa I/O, coperta solo da e2e — vedi CLAUDE.md, criterio unit test).
// Elenco vuoto prima del giorno 3, nei mesi interamente chiusi o se tutte
// le comunicazioni sono state inviate. Funziona sia con la sessione
// dell'admin (pagina Allarmi, campanella: RLS admin-only su costi e
// comunicazioni) sia con la service_role key del cron (migration 0061:
// SELECT su costi_bambini e comunicazioni_retta).
export async function calcolaRetteNonComunicate(supabase: SupabaseClient, oggi: string): Promise<BambinoRetta[]> {
  const mese = meseDaData(oggi);
  const chiusure = await chiusurePerPeriodo(supabase, primoGiornoMese(mese), ultimoGiornoMese(mese));
  if (!allarmeRetteDaControllare(oggi, chiusure)) return [];

  const [{ data: bambini }, { data: sezioni }, { data: costi }, { data: comunicazioni }] = await Promise.all([
    supabase.from('bambini').select('id, nome, cognome, sezione_id').eq('attiva', true),
    supabase.from('sezioni').select('id, nome'),
    supabase.from('costi_bambini').select('bambino_id, email_promemoria'),
    supabase.from('comunicazioni_retta').select('bambino_id').eq('mese', mese),
  ]);

  return bambiniRetteNonComunicate({
    bambini: bambini ?? [],
    sezioni: sezioni ?? [],
    costi: costi ?? [],
    idComunicati: (comunicazioni ?? []).map((c) => c.bambino_id),
  });
}
