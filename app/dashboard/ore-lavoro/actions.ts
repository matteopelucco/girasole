'use server';

import { revalidatePath } from 'next/cache';
import { requireStaff, requireAdmin, assicuraAccessoOreLavoro } from '@/lib/auth';
import { oggi, giorniSettimana, meseDaData, primoGiornoMese } from '@/lib/date';
import { chiusurePerPeriodo } from '@/lib/calendarioScolastico';
import {
  validaSettimanaOreLavoro,
  oreOrdinariePreviste,
  statoPredefinitoGiornoOreLavoro,
  isStatoNeutroOreLavoro,
  settimanaOreLavoroRichiesta,
  utenteBersaglioOreLavoro,
} from '@/lib/oreLavoro';
import {
  controlloSettimanaOreLavoro,
  notaMovimentoStraordinarioResiduo,
  segnoVersoMovimentoMonteOre,
} from '@/lib/monteOre';
import {
  notaConfermaMese,
  nuovaVariazioneConferma,
  parteNonConfermata,
  puoConfermareMese,
} from '@/lib/monteOreMensile';
import { calcoloMensilePerUtente } from '@/lib/monteOreMensileDati';
import { recuperaProfiloOrario } from '@/lib/profiliOrari';
import type { EsitoAzione } from '@/components/FormConEsito';

// Il personale può modificare/confermare qualunque settimana passata,
// oltre a quella corrente (specs/18) — ma mai una settimana futura:
// riusa la stessa risoluzione della pagina (settimanaOreLavoroRichiesta)
// per validare il campo nascosto settimana_inizio inviato dal form,
// invece di duplicare lo stesso controllo qui.
function settimanaValidaPerScrittura(formData: FormData): string | null {
  const richiesta = (formData.get('settimana_inizio') as string) || '';
  const risolta = settimanaOreLavoroRichiesta(richiesta, oggi());
  return risolta === richiesta ? richiesta : null;
}

// Utente su cui scrivere (utenteBersaglioOreLavoro) più il controllo di
// accesso che ne consegue: se si scrive su se stessi serve la propria
// abilitazione (assicuraAccessoOreLavoro, nessun bypass); se si scrive
// sull'utente indicato da un altro (solo un admin può farlo) l'accesso
// dipende dal ruolo, non dall'abilitazione di chi scrive — vedi
// utenteBersaglioOreLavoro. Condivisa da entrambe le server action
// sotto per non ripetere lo stesso controllo due volte (CLAUDE.md,
// jscpd).
function risolviUtenteBersaglio(
  ruolo: string | null | undefined,
  userId: string,
  abilitato: boolean | null | undefined,
  formData: FormData
): string {
  const utenteId = utenteBersaglioOreLavoro(ruolo, userId, formData.get('utente_id') as string | null);
  if (utenteId === userId) {
    assicuraAccessoOreLavoro(abilitato);
  }
  return utenteId;
}

// Valore del campo "Differenza ore": accetta anche la virgola decimale
// italiana; campo vuoto = 0, testo non numerico = NaN (rifiutato).
function differenzaDaForm(valore: FormDataEntryValue | null): number {
  const testo = typeof valore === 'string' ? valore.trim().replace(',', '.') : '';
  return testo === '' ? 0 : Number(testo);
}

// Profilo orario dell'utente su cui si scrive: quello di chi invia se
// scrive su se stesso, altrimenti quello dell'utente indicato (solo un
// admin può farlo) — condiviso da salvataggio e conferma, per calcolare
// le ore previste sempre sul profilo giusto e mai sul valore inviato
// dal client.
async function profiloOrarioDelBersaglio(
  supabase: Awaited<ReturnType<typeof requireStaff>>['supabase'],
  userId: string,
  profiloOrarioIdProprio: string | null | undefined,
  utenteId: string
) {
  let profiloOrarioId = profiloOrarioIdProprio ?? null;
  if (utenteId !== userId) {
    const { data: profiloAltro } = await supabase
      .from('profili')
      .select('profilo_orario_id')
      .eq('id', utenteId)
      .maybeSingle();
    profiloOrarioId = profiloAltro?.profilo_orario_id ?? null;
  }
  return recuperaProfiloOrario(supabase, profiloOrarioId);
}

// Salva le ore/lo stato di ogni giorno della settimana indicata
// (specs/18: quella corrente o una passata, mai una futura) — valida
// PRIMA tutti i giorni inviati (funzione pura, nessun I/O) e scrive
// solo se sono tutti validi: nessun salvataggio parziale su un errore
// (specs/05 - feedback.md).
//
// Scrive sull'utente indicato dal campo nascosto `utente_id` SOLO se
// chi invia è admin (specs/18, sezione "Amministrazione" — l'admin può
// correggere le ore di chiunque sia abilitato, anche una settimana già
// confermata); chiunque altro scrive sempre e solo su se stesso,
// qualunque valore arrivi dal client (utenteBersaglioOreLavoro).
export async function salvaSettimanaOreLavoro(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase, user, profilo, ruolo } = await requireStaff({});
  const utenteId = risolviUtenteBersaglio(ruolo, user.id, profilo?.abilitato_ore_lavoro, formData);

  const settimanaInizio = settimanaValidaPerScrittura(formData);
  if (!settimanaInizio) {
    return { ok: false, messaggio: 'Non puoi modificare una settimana futura.' };
  }

  const giorni = giorniSettimana(settimanaInizio);
  const profiloOrario = await profiloOrarioDelBersaglio(supabase, user.id, profilo?.profilo_orario_id, utenteId);

  // Valida TUTTI i giorni e raccoglie ogni errore (non solo il primo): il
  // popup "Settimana non salvata" li elenca insieme (specs/18). Le regole
  // sono quelle di sempre (validaGiornoOreLavoro).
  const validazione = validaSettimanaOreLavoro(
    giorni.map((data) => ({
      data,
      stato: (formData.get(`stato_${data}`) as string) || 'lavorativo',
      orePreviste: oreOrdinariePreviste(profiloOrario, data),
      // Vuoto = 0 (default); un testo non numerico resta NaN e viene
      // rifiutato dalla validazione, non azzerato in silenzio.
      differenzaOre: differenzaDaForm(formData.get(`differenza_ore_${data}`)),
      motivo: (formData.get(`motivo_${data}`) as string) || '',
      codiceMalattia: (formData.get(`codice_malattia_${data}`) as string) || '',
      notaAssenza: (formData.get(`nota_assenza_${data}`) as string) || '',
    }))
  );
  if (!validazione.ok) {
    return {
      ok: false,
      messaggio:
        'La settimana non è stata salvata: nessuna modifica è stata registrata. Correggi le incongruenze elencate e salva di nuovo.',
      elenco: validazione.errori,
    };
  }
  const daScrivere = validazione.giorni;

  if (!daScrivere.length) {
    return { ok: true };
  }

  const { error } = await supabase.from('ore_lavoro_giorni').upsert(
    daScrivere.map((g) => ({
      utente_id: utenteId,
      data: g.data,
      stato: g.stato,
      ore_ordinarie: g.oreOrdinarie,
      ore_straordinarie: g.oreStraordinarie,
      motivo_straordinario: g.motivoStraordinario,
      codice_malattia: g.codiceMalattia,
      nota_assenza: g.notaAssenza,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'utente_id,data' }
  );
  if (error) {
    return { ok: false, messaggio: 'Impossibile salvare le ore della settimana.', dettaglio: error.message };
  }

  revalidatePath('/dashboard/ore-lavoro', 'layout');
  return { ok: true };
}

// Conferma la settimana indicata (specs/18: quella corrente o una
// passata, mai una futura): prima completa con i valori precaricati dal
// profilo orario ogni giorno non ancora salvato esplicitamente
// (scenario "confermare la settimana"), poi registra la conferma vera e
// propria — l'esistenza della riga in ore_lavoro_settimane È la
// conferma (stesso pattern di report_giornalieri_inviati, specs/52).
//
// Come salvaSettimanaOreLavoro sopra, conferma per conto di un altro
// utente solo se chi invia è admin (specs/18, "Amministrazione") — in
// quel caso usa il profilo orario DI QUELL'UTENTE (non quello di chi
// sta confermando) per precaricare i giorni mancanti.
export async function confermaSettimanaOreLavoro(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase, user, profilo, ruolo } = await requireStaff({});
  const utenteId = risolviUtenteBersaglio(ruolo, user.id, profilo?.abilitato_ore_lavoro, formData);

  const settimanaInizio = settimanaValidaPerScrittura(formData);
  if (!settimanaInizio) {
    return { ok: false, messaggio: 'Non puoi confermare una settimana futura.' };
  }

  const giorni = giorniSettimana(settimanaInizio);

  const { data: esistenti } = await supabase
    .from('ore_lavoro_giorni')
    .select('data')
    .eq('utente_id', utenteId)
    .in('data', giorni);
  const dateEsistenti = new Set((esistenti ?? []).map((r) => r.data));

  const profiloOrario = await profiloOrarioDelBersaglio(supabase, user.id, profilo?.profilo_orario_id, utenteId);

  // Un giorno non ancora salvato in un giorno di chiusura scolastica si
  // completa come "Chiusura" (ore a 0, neutro per il monte ore), gli
  // altri con le ore previste dal profilo (specs/18).
  const chiusure = await chiusurePerPeriodo(supabase, giorni[0], giorni[giorni.length - 1]);
  const daCompletare = giorni
    .filter((data) => !dateEsistenti.has(data))
    .map((data) => {
      const stato = statoPredefinitoGiornoOreLavoro(data, chiusure);
      return {
        utente_id: utenteId,
        data,
        stato,
        ore_ordinarie: isStatoNeutroOreLavoro(stato) ? 0 : oreOrdinariePreviste(profiloOrario, data),
        ore_straordinarie: 0,
      };
    });

  if (daCompletare.length) {
    const { error: erroreCompletamento } = await supabase.from('ore_lavoro_giorni').insert(daCompletare);
    if (erroreCompletamento) {
      return {
        ok: false,
        messaggio: 'Impossibile completare i giorni mancanti prima della conferma.',
        dettaglio: erroreCompletamento.message,
      };
    }
  }

  // A questo punto tutti e 7 i giorni esistono di sicuro (appena
  // completati sopra, o già salvati esplicitamente prima): li
  // rileggiamo per intero per calcolare il controllo della settimana
  // (specs/19 - monte-ore.md), che serve gli stessi dati appena
  // confermati e lo stesso profilo orario già risolto sopra.
  const { data: giorniCompleti } = await supabase
    .from('ore_lavoro_giorni')
    .select('data, stato, ore_ordinarie, ore_straordinarie')
    .eq('utente_id', utenteId)
    .in('data', giorni);
  const controllo = controlloSettimanaOreLavoro(
    (giorniCompleti ?? []).map((g) => ({
      data: g.data,
      stato: g.stato,
      oreOrdinarie: g.ore_ordinarie,
      oreStraordinarie: g.ore_straordinarie,
    })),
    profiloOrario
  );

  const { error } = await supabase.from('ore_lavoro_settimane').insert({
    utente_id: utenteId,
    settimana_inizio: settimanaInizio,
    ore_dovute: controllo.oreDovute,
    ore_ordinarie_erogate: controllo.oreOrdinarieErogate,
    ore_straordinarie_erogate: controllo.oreStraordinarieErogate,
    // Il concetto di "straordinario residuo in attesa di decisione" non
    // si genera più da questo punto in poi (specs/19, netto pieno): la
    // colonna resta per lo storico delle settimane confermate PRIMA di
    // questo cambio (StraordinarioResiduo.tsx continua a mostrarle),
    // ma da qui in avanti è sempre 0.
    straordinario_residuo: 0,
  });
  if (error) {
    if (error.code === '23505') {
      return { ok: false, messaggio: 'Questa settimana risulta già confermata.' };
    }
    return { ok: false, messaggio: 'Impossibile confermare la settimana.', dettaglio: error.message };
  }

  // Il monte ore è gestito a mano dall'admin (specs/19): la conferma blocca
  // solo la modifica autonoma delle ore, non registra alcun movimento.
  revalidatePath('/dashboard/ore-lavoro', 'layout');
  return { ok: true };
}

// Riapre una settimana già confermata (specs/18, "l'admin riapre una
// settimana già confermata", issue #90): la conferma è l'esistenza della
// riga in `ore_lavoro_settimane`, quindi riaprire = eliminarla. Solo
// l'admin (requireAdmin qui e policy di delete admin-only in
// 0025_report_ore_lavoro.sql: nessuna migration nuova). Le ore salvate e il
// monte ore (gestito a mano, specs/19) non cambiano; il dipendente può di
// nuovo modificare la settimana e deve riconfermarla.
export async function riapriSettimanaOreLavoro(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();

  const utenteId = (formData.get('utente_id') as string) || '';
  const settimanaInizio = (formData.get('settimana_inizio') as string) || '';
  if (!utenteId || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(settimanaInizio)) {
    return { ok: false, messaggio: 'Settimana o dipendente non validi.' };
  }

  // .select() per distinguere "riaperta" da "nessuna riga eliminata": con
  // la RLS un delete non permesso o su una riga inesistente non dà errore.
  const { data, error } = await supabase
    .from('ore_lavoro_settimane')
    .delete()
    .eq('utente_id', utenteId)
    .eq('settimana_inizio', settimanaInizio)
    .select('id');
  if (error) {
    return { ok: false, messaggio: 'Impossibile riaprire la settimana.', dettaglio: error.message };
  }
  if (!data?.length) {
    return { ok: false, messaggio: 'Questa settimana non risulta confermata.' };
  }

  revalidatePath('/dashboard/ore-lavoro', 'layout');
  return { ok: true };
}

// Decisione dell'admin sullo straordinario residuo di una settimana già
// confermata (specs/19 - monte-ore.md): "pagamento_mensile" non tocca il
// monte ore (pagato fuori da quest'app), "monte_ore" registra un
// movimento positivo (ore già erogate, a credito). Solo l'admin può
// decidere, solo una volta per settimana (decisione immutabile una
// volta presa — stesso principio dei movimenti, mai un update
// successivo su questo campo se non tramite questa azione).
export async function decidiStraordinarioResiduo(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase, user } = await requireAdmin();

  const utenteId = (formData.get('utente_id') as string) || '';
  const settimanaInizio = (formData.get('settimana_inizio') as string) || '';
  const decisione = formData.get('decisione') as string;

  if (decisione !== 'pagamento_mensile' && decisione !== 'monte_ore') {
    return { ok: false, messaggio: 'Decisione non valida.' };
  }

  const { data: settimana } = await supabase
    .from('ore_lavoro_settimane')
    .select('straordinario_residuo, decisione_straordinari')
    .eq('utente_id', utenteId)
    .eq('settimana_inizio', settimanaInizio)
    .maybeSingle();

  if (!settimana || !settimana.straordinario_residuo) {
    return { ok: false, messaggio: 'Nessuno straordinario residuo da decidere per questa settimana.' };
  }
  if (settimana.decisione_straordinari) {
    return { ok: false, messaggio: 'La decisione per questa settimana è già stata presa.' };
  }

  const { error } = await supabase
    .from('ore_lavoro_settimane')
    .update({
      decisione_straordinari: decisione,
      decisione_straordinari_at: new Date().toISOString(),
      decisione_straordinari_admin_id: user.id,
    })
    .eq('utente_id', utenteId)
    .eq('settimana_inizio', settimanaInizio);
  if (error) {
    return { ok: false, messaggio: 'Impossibile registrare la decisione.', dettaglio: error.message };
  }

  if (decisione === 'monte_ore') {
    const { error: erroreMovimento } = await supabase.from('monte_ore_movimenti').insert({
      utente_id: utenteId,
      tipo: 'straordinario_residuo',
      settimana_inizio: settimanaInizio,
      mese_competenza: primoGiornoMese(meseDaData(oggi())),
      variazione: settimana.straordinario_residuo,
      nota: notaMovimentoStraordinarioResiduo(settimana.straordinario_residuo),
    });
    if (erroreMovimento) {
      return {
        ok: false,
        messaggio:
          'La decisione è stata registrata, ma non è stato possibile aggiornare il monte ore. Contatta l\'admin per una correzione manuale.',
        dettaglio: erroreMovimento.message,
      };
    }
  }

  revalidatePath('/dashboard/ore-lavoro', 'layout');
  return { ok: true };
}

const MESSAGGIO_MESE_GIA_CONFERMATO = 'Mese già confermato';
const ESPRESSIONE_MESE = /^\d{4}-(0[1-9]|1[0-2])$/;

// Mese di competenza inviato dal form (AAAA-MM) come data AAAA-MM-01:
// valido solo se ben formato e non successivo al mese corrente (specs/19,
// MOR-08/MOR-09). Altrimenti null. Il controllo vero è qui, non nel select.
function meseCompetenzaDaForm(formData: FormData): string | null {
  const mese = ((formData.get('mese_competenza') as string) || '').trim();
  if (!ESPRESSIONE_MESE.test(mese) || mese > meseDaData(oggi())) return null;
  return primoGiornoMese(mese);
}

const MESSAGGIO_MESE_NON_VALIDO = 'Scegli un mese di competenza valido (non successivo al mese corrente).';

// Movimento manuale di monte ore (specs/19 - monte-ore.md): solo
// l'admin può registrarlo, per qualunque utente abilitato, sempre con
// una nota obbligatoria (non è un dato calcolato, va motivato). `verso`
// è 'credito' (il dipendente ha erogato ore in più, +) o 'debito' (deve
// ancora erogare ore, −): la UI chiede sempre un numero di ore positivo,
// è questa funzione a tradurlo nella `variazione` con il segno della
// convenzione di specs/19.
export async function aggiungiMovimentoMonteOre(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();

  const utenteId = (formData.get('utente_id') as string) || '';
  const segno = segnoVersoMovimentoMonteOre((formData.get('verso') as string) || '');
  const ore = Number(formData.get('ore'));
  const nota = ((formData.get('nota') as string) || '').trim();
  const meseCompetenza = meseCompetenzaDaForm(formData);

  if (!utenteId) {
    return { ok: false, messaggio: 'Utente non valido.' };
  }
  if (!meseCompetenza) return { ok: false, messaggio: MESSAGGIO_MESE_NON_VALIDO };
  if (segno === null) {
    return { ok: false, messaggio: 'Scegli se il dipendente ha erogato ore in più o deve ancora erogare ore.' };
  }
  if (!Number.isFinite(ore) || ore <= 0) {
    return { ok: false, messaggio: 'Indica un numero di ore maggiore di zero.' };
  }
  if (!nota) {
    return { ok: false, messaggio: 'Indica una nota che motivi il movimento di monte ore.' };
  }

  const { error } = await supabase.from('monte_ore_movimenti').insert({
    utente_id: utenteId,
    tipo: 'precarico',
    variazione: segno * ore,
    nota,
    mese_competenza: meseCompetenza,
  });
  if (error) {
    return { ok: false, messaggio: 'Impossibile registrare il movimento di monte ore.', dettaglio: error.message };
  }

  revalidatePath('/dashboard/ore-lavoro', 'layout');
  return { ok: true };
}

// specs/19 - monte-ore.md, scenario "l'admin elimina un movimento di monte
// ore": la gestione è manuale, quindi l'admin può eliminare qualunque
// movimento, anche storico. La RLS
// (supabase/migrations/0055_monte_ore_manuale.sql) è la difesa primaria:
// solo l'admin può cancellare.
export async function eliminaMovimentoMonteOre(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();

  const id = (formData.get('id') as string) || '';
  if (!id) return { ok: false, messaggio: 'Movimento non valido.' };

  const { data, error } = await supabase.from('monte_ore_movimenti').delete().eq('id', id).select('id');
  if (error) {
    return { ok: false, messaggio: 'Impossibile eliminare il movimento.', dettaglio: error.message };
  }
  // Nessuna riga cancellata (id inesistente, o RLS che rifiuta): non è un successo.
  if (!data?.length) return { ok: false, messaggio: 'Movimento non trovato.' };

  revalidatePath('/dashboard/ore-lavoro', 'layout');
  return { ok: true };
}

// specs/19 - monte-ore.md, scenario "l'admin modifica un movimento di
// monte ore": cambia ore, verso (credito/debito) e nota di qualunque
// movimento, mantenendone la data di registrazione. Stesse regole di
// validazione dell'inserimento (ore > 0, nota obbligatoria).
export async function modificaMovimentoMonteOre(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();

  const id = (formData.get('id') as string) || '';
  const segno = segnoVersoMovimentoMonteOre((formData.get('verso') as string) || '');
  const ore = Number(formData.get('ore'));
  const nota = ((formData.get('nota') as string) || '').trim();
  const meseCompetenza = meseCompetenzaDaForm(formData);

  if (!id) return { ok: false, messaggio: 'Movimento non valido.' };
  if (!meseCompetenza) return { ok: false, messaggio: MESSAGGIO_MESE_NON_VALIDO };
  if (segno === null) {
    return { ok: false, messaggio: 'Scegli se il dipendente ha erogato ore in più o deve ancora erogare ore.' };
  }
  if (!Number.isFinite(ore) || ore <= 0) {
    return { ok: false, messaggio: 'Indica un numero di ore maggiore di zero.' };
  }
  if (!nota) {
    return { ok: false, messaggio: 'Indica una nota che motivi il movimento di monte ore.' };
  }

  const { data, error } = await supabase
    .from('monte_ore_movimenti')
    .update({ variazione: segno * ore, nota, mese_competenza: meseCompetenza })
    .eq('id', id)
    .select('id');
  if (error?.code === '23505') {
    return { ok: false, messaggio: 'Quel mese è già confermato per questa persona: esiste già una conferma di quel mese.' };
  }
  if (error) {
    return { ok: false, messaggio: 'Impossibile modificare il movimento.', dettaglio: error.message };
  }
  if (!data?.length) return { ok: false, messaggio: 'Movimento non trovato.' };

  revalidatePath('/dashboard/ore-lavoro', 'layout');
  return { ok: true };
}

// Conferma della differenza ore di un mese chiuso (specs/19, MOR-01..MOR-07):
// solo l'admin. Il valore da registrare lo calcola il server qui, ogni volta,
// dalla differenza del mese e dai movimenti di quel mese: mai un numero
// inviato dal browser (che può essere vecchio o manomesso). Una sola conferma
// per persona e mese: se c'è già, la parte non confermata si somma alla sua
// variazione. Doppio click o due admin: l'indice unico (23505 in inserimento)
// e il confronto con la variazione letta (in aggiornamento) fanno sì che la
// richiesta in più non registri nulla e risponda "Mese già confermato".
export async function confermaMeseMonteOre(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();

  const utenteId = ((formData.get('utente_id') as string) || '').trim();
  const mese = ((formData.get('mese') as string) || '').trim();
  if (!utenteId || !ESPRESSIONE_MESE.test(mese)) return { ok: false, messaggio: 'Mese o utente non validi.' };

  const oggiData = oggi();
  const meseCorrente = meseDaData(oggiData);
  // Mese in corso o futuro: mai confermabile (MOR-04).
  if (mese >= meseCorrente) return { ok: false, messaggio: 'Si può confermare solo un mese già chiuso.' };

  const { data: persona } = await supabase
    .from('profili')
    .select('profilo_orario_id')
    .eq('id', utenteId)
    .eq('abilitato_ore_lavoro', true)
    .maybeSingle();
  if (!persona) return { ok: false, messaggio: 'Utente non valido.' };

  const [profiloOrario, { data: movimenti }, { data: esistente }] = await Promise.all([
    recuperaProfiloOrario(supabase, persona.profilo_orario_id),
    supabase.from('monte_ore_movimenti').select('variazione, created_at, mese_competenza').eq('utente_id', utenteId),
    supabase
      .from('monte_ore_movimenti')
      .select('id, variazione')
      .eq('utente_id', utenteId)
      .eq('tipo', 'conferma_mese')
      .eq('mese_competenza', primoGiornoMese(mese))
      .maybeSingle(),
  ]);
  const righe = await calcoloMensilePerUtente(supabase, {
    utenteId,
    profiloOrario,
    oggiData,
    movimenti: movimenti ?? [],
  });
  const riga = righe.find((r) => r.mese === mese);

  if (!riga || !puoConfermareMese(riga, meseCorrente)) {
    const giaCoperto = Boolean(esistente) || (riga !== undefined && riga.movimenti !== 0);
    // Pagina vecchia (secondo admin, doppio click): si aggiorna anche qui, così
    // la riga non resta con un pulsante che non serve più (MOR-06).
    revalidatePath('/dashboard/ore-lavoro', 'layout');
    return { ok: true, avviso: giaCoperto ? MESSAGGIO_MESE_GIA_CONFERMATO : 'Niente da confermare' };
  }

  const variazione = nuovaVariazioneConferma(esistente?.variazione ?? null, parteNonConfermata(riga));
  const nota = notaConfermaMese(mese, variazione);

  if (!esistente) {
    const { error } = await supabase.from('monte_ore_movimenti').insert({
      utente_id: utenteId,
      tipo: 'conferma_mese',
      variazione,
      nota,
      mese_competenza: primoGiornoMese(mese),
    });
    if (error?.code === '23505') {
      revalidatePath('/dashboard/ore-lavoro', 'layout');
      return { ok: true, avviso: MESSAGGIO_MESE_GIA_CONFERMATO };
    }
    if (error) return { ok: false, messaggio: 'Impossibile confermare il mese.', dettaglio: error.message };
  } else {
    const { data, error } = await supabase
      .from('monte_ore_movimenti')
      .update({ variazione, nota })
      .eq('id', esistente.id)
      .eq('variazione', esistente.variazione)
      .select('id');
    if (error) return { ok: false, messaggio: 'Impossibile confermare il mese.', dettaglio: error.message };
    if (!data?.length) {
      revalidatePath('/dashboard/ore-lavoro', 'layout');
      return { ok: true, avviso: MESSAGGIO_MESE_GIA_CONFERMATO };
    }
  }

  revalidatePath('/dashboard/ore-lavoro', 'layout');
  return { ok: true };
}
