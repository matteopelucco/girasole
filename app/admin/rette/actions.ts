'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { chiusurePerPeriodo } from '@/lib/calendarioScolastico';
import {
  formattaImporto,
  giorniAperturaMese,
  corpoEmailHtmlRetta,
  riepilogoRigaRetta,
  sostituisciPlaceholder,
  type ParametriRiepilogoRetta,
  type RiepilogoRetta,
} from '@/lib/comunicazioneRetta';
import { emailsDaCampo } from '@/lib/costiBambino';
import { meseDaData, mesePrecedente, oggi, formattaMeseItaliano, primoGiornoMese, ultimoGiornoMese } from '@/lib/date';
import { destinatarioNotifiche, inviaEmail } from '@/lib/email';
import { pastiEffettiviPerBambino } from '@/lib/retteDati';
import type { EsitoAzione } from '@/components/FormConEsito';

// Testo di un campo del modulo: un valore mancante o non testuale (es. un
// file) vale testo vuoto, cioè 0 per `importoDaCampoRetta`.
function testoCampo(valore: FormDataEntryValue | null): string {
  return typeof valore === 'string' ? valore : '';
}

type SupabaseAdmin = Awaited<ReturnType<typeof requireAdmin>>['supabase'];

// Giorni di apertura di un mese (specs/56): un solo calcolo per mese,
// condiviso da tutti i bambini di uno stesso invio (massivo o singolo)
// — evita di rileggere le chiusure registrate una volta per bambino.
async function giorniAperturaDelMese(supabase: SupabaseAdmin, mese: string): Promise<number> {
  const chiusure = await chiusurePerPeriodo(supabase, primoGiornoMese(mese), ultimoGiornoMese(mese));
  return giorniAperturaMese(mese, chiusure);
}

// Dati comuni a tutti i bambini di uno stesso invio, letti dal server.
type DatiMese = { giorniApertura: number; pastiPotenziali: number };

async function datiMese(supabase: SupabaseAdmin, meseCorrente: string): Promise<DatiMese> {
  const [giorniApertura, pastiPotenziali] = await Promise.all([
    giorniAperturaDelMese(supabase, meseCorrente),
    giorniAperturaDelMese(supabase, mesePrecedente(meseCorrente)),
  ]);
  return { giorniApertura, pastiPotenziali };
}

type CostiPerRiepilogo = {
  prezzo_mensile: number | string;
  prezzo_buono_pasto: number | string;
  prezzo_marca_da_bollo: number | string;
  pre_asilo_richiesto: boolean;
  prezzo_pre_asilo: number | string;
  post_asilo_richiesto: boolean;
  prezzo_post_asilo: number | string;
};

// Colonne di `costi_bambini` che servono al riepilogo, lette dal server.
const COLONNE_COSTI_RIEPILOGO =
  'prezzo_mensile, prezzo_buono_pasto, prezzo_marca_da_bollo, pre_asilo_richiesto, prezzo_pre_asilo, post_asilo_richiesto, prezzo_post_asilo';

// Riepilogo di un bambino al momento dell'invio (specs/56, RET-18): tutto ciò
// che non è un campo modificabile (retta, marca da bollo, costo pasti,
// conguaglio pasti, pre-asilo, post-asilo, credito/debito) è ricalcolato qui
// dai dati attuali (`costi_bambini`, pasti, chiusure, crediti/debiti), MAI
// letto dal modulo: un campo nascosto manomesso o un valore vecchio sono
// ignorati. Dal modulo si leggono solo gettoni pre/post, costi extra e nota
// (RET-16), con le stesse regole della tabella (`riepilogoRigaRetta`: vuoto,
// non valido o negativo = 0). Funzione pura sui dati già letti.
function riepilogoDalForm(
  formData: FormData,
  bambinoId: string,
  costi: CostiPerRiepilogo,
  dati: DatiMese,
  pastiEffettivi: number,
  creditoDebito: number
): RiepilogoRetta {
  const fissi: Omit<ParametriRiepilogoRetta, 'gettoniPreAsilo' | 'gettoniPostAsilo' | 'costiExtra'> = {
    prezzoMensile: Number(costi.prezzo_mensile),
    prezzoBuonoPasto: Number(costi.prezzo_buono_pasto),
    giorniAperturaMeseCorrente: dati.giorniApertura,
    pastiPotenzialiMesePrecedente: dati.pastiPotenziali,
    pastiEffettiviMesePrecedente: pastiEffettivi,
    marcaDaBollo: Number(costi.prezzo_marca_da_bollo),
    preAsiloRichiesto: costi.pre_asilo_richiesto,
    prezzoPreAsilo: Number(costi.prezzo_pre_asilo),
    postAsiloRichiesto: costi.post_asilo_richiesto,
    prezzoPostAsilo: Number(costi.prezzo_post_asilo),
    creditoDebito,
  };
  return riepilogoRigaRetta(fissi, {
    gettoniPreAsilo: testoCampo(formData.get(`gettoni_pre_asilo_${bambinoId}`)),
    gettoniPostAsilo: testoCampo(formData.get(`gettoni_post_asilo_${bambinoId}`)),
    costiExtra: testoCampo(formData.get(`costi_extra_${bambinoId}`)),
  });
}

// Numero di gettoni (intero non negativo) arrivato nel campo nascosto del form.
function numeroIntero(valore: FormDataEntryValue | null): number {
  const numero = Number(valore);
  return Number.isInteger(numero) && numero >= 0 ? numero : 0;
}

// Numero di gettoni pre/post-asilo letto dai campi nascosti del form. È solo
// un'etichetta per l'admin e per l'email: non entra nel totale, che usa gli
// importi dei gettoni (modificabili come gli altri campi della retta).
type NumeriGettoni = { pre: number; post: number };

function numeriGettoniDalForm(formData: FormData, bambinoId: string): NumeriGettoni {
  return {
    pre: numeroIntero(formData.get(`numero_gettoni_pre_asilo_${bambinoId}`)),
    post: numeroIntero(formData.get(`numero_gettoni_post_asilo_${bambinoId}`)),
  };
}

// Placeholder sostituiti nel template della mail (specs/56), a partire
// da un riepilogo già letto dal form (mai ricalcolato). Funzione pura,
// nessun I/O: condivisa dall'invio massivo e da quello singolo per non
// duplicare la stessa costruzione due volte (CLAUDE.md, jscpd).
function placeholderRetta(
  bambino: { nome: string; cognome: string },
  mese: string,
  riepilogo: RiepilogoRetta,
  numeriGettoni: NumeriGettoni,
  noteExtra: string | null,
  notaCreditoDebito: string | null
): Record<string, string> {
  return {
    nome: bambino.nome,
    cognome: bambino.cognome,
    mese: formattaMeseItaliano(mese),
    retta_mensile: formattaImporto(riepilogo.rettaMensile),
    costo_pasti: formattaImporto(riepilogo.costoPasti),
    conguaglio_pasti: formattaImporto(riepilogo.conguaglioPasti),
    marca_da_bollo: formattaImporto(riepilogo.marcaDaBollo),
    costo_pre_asilo: formattaImporto(riepilogo.costoPreAsilo),
    costo_post_asilo: formattaImporto(riepilogo.costoPostAsilo),
    gettoni_pre_asilo: formattaImporto(riepilogo.gettoniPreAsilo),
    numero_gettoni_pre_asilo: String(numeriGettoni.pre),
    gettoni_post_asilo: formattaImporto(riepilogo.gettoniPostAsilo),
    numero_gettoni_post_asilo: String(numeriGettoni.post),
    costi_extra: formattaImporto(riepilogo.costiExtra),
    note_costi_extra: noteExtra ?? '',
    credito_debito: formattaImporto(riepilogo.creditoDebito),
    nota_credito_debito: notaCreditoDebito ?? '',
    totale: formattaImporto(riepilogo.totale),
  };
}

type TemplateRetta = { oggetto: string; corpo: string } | null;

// Invia la mail a un bambino e registra il log in comunicazioni_retta
// (specs/56): stessa sequenza "invia, poi registra solo se l'invio è
// riuscito" per l'invio massivo e per quello singolo — nessun log per
// un'email che non è mai partita davvero (a differenza di "registra
// prima", che lascerebbe un bambino segnato "Inviata" senza che
// l'abbia mai ricevuta). Ritorna true se inviato e registrato con
// successo, false altrimenti (email/log falliti): il chiamante decide
// come riportarlo (EsitoAzione per l'invio massivo, void per il
// singolo — specs/05, "l'effetto è la conferma").
async function inviaEPersistiComunicazione(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  bambino: { id: string; nome: string; cognome: string },
  email: string,
  mese: string,
  riepilogo: RiepilogoRetta,
  numeriGettoni: NumeriGettoni,
  noteExtra: string | null,
  notaCreditoDebito: string | null,
  template: TemplateRetta,
  inviataDa: { id: string; nome: string },
  // false = "Conferma senza inviare" (specs/56): stessa sequenza, ma il
  // solo passo dell'invio e-mail (famiglia e copia all'asilo) è saltato.
  inviaMail: boolean
): Promise<boolean> {
  const valoriPlaceholder = placeholderRetta(bambino, mese, riepilogo, numeriGettoni, noteExtra, notaCreditoDebito);
  const oggetto = sostituisciPlaceholder(template?.oggetto ?? 'Promemoria retta {{mese}}', valoriPlaceholder);
  // Corpo: testo escapato (specs/56); oggetto: testo semplice, non HTML.
  const corpoHtml = corpoEmailHtmlRetta(template?.corpo ?? '', valoriPlaceholder);

  try {
    // specs/55, "più indirizzi email di promemoria, separati da ;": un
    // solo invio, con tutti gli indirizzi come destinatari.
    // Reply-To all'asilo: le risposte dei genitori non tornano al mittente
    // tecnico (specs/56, issue #245).
    if (inviaMail) {
      await inviaEmail({
        a: emailsDaCampo(email),
        cc: destinatarioNotifiche(),
        rispondiA: destinatarioNotifiche(),
        oggetto,
        html: corpoHtml,
      });
    }
  } catch (errore) {
    return false;
  }

  const { error: erroreLog } = await supabase.from('comunicazioni_retta').insert({
    bambino_id: bambino.id,
    mese,
    retta_mensile: riepilogo.rettaMensile,
    costo_pasti: riepilogo.costoPasti,
    conguaglio_pasti: riepilogo.conguaglioPasti,
    marca_da_bollo: riepilogo.marcaDaBollo,
    costo_pre_asilo: riepilogo.costoPreAsilo,
    costo_post_asilo: riepilogo.costoPostAsilo,
    gettoni_pre_asilo: riepilogo.gettoniPreAsilo,
    numero_gettoni_pre_asilo: numeriGettoni.pre,
    gettoni_post_asilo: riepilogo.gettoniPostAsilo,
    numero_gettoni_post_asilo: numeriGettoni.post,
    costi_extra: riepilogo.costiExtra,
    note_costi_extra: noteExtra,
    credito_debito: riepilogo.creditoDebito,
    nota_credito_debito: notaCreditoDebito,
    totale: riepilogo.totale,
    email_destinatario: email,
    inviata_da: inviataDa.id,
    inviata_da_nome: inviataDa.nome,
  });

  if (erroreLog) return false;

  // specs/58, scenario "inviare la comunicazione applica il
  // credito/debito": il credito/debito "da conteggiare" per questo
  // bambino e questo mese (se esiste) passa da "da conteggiare" a
  // "conteggiato" — un no-op sicuro se non ce n'era nessuno.
  await supabase
    .from('crediti_debiti_bambini')
    .update({ applicato_il: new Date().toISOString() })
    .eq('bambino_id', bambino.id)
    .eq('mese_competenza', mese)
    .is('applicato_il', null);

  return true;
}

// specs/56 - comunicazione-retta-mensile.md, scenario "inviare le
// comunicazioni con un click": determina da sé chi è ammesso all'invio
// — bambino attivo, con email configurata (specs/55), non ancora
// comunicato questo mese — invece di fidarsi di un elenco arrivato dal
// client. Dal form si leggono solo gettoni, costi extra e nota
// (riepilogoDalForm sopra); conguaglio pasti, pre-asilo, post-asilo, retta,
// marca da bollo, costo pasti e credito/debito sono sempre ricalcolati/letti
// qui dal server (specs/56 RET-18, specs/58), mai dal modulo. Il popup di conferma è lato
// client (components/PulsanteInvio.tsx, prop confermaMessaggio): se
// l'admin lo annulla, il form non viene nemmeno inviato, questa funzione
// non parte.
export async function inviaComunicazioniRetta(
  _stato: EsitoAzione,
  formData: FormData
): Promise<EsitoAzione> {
  const { supabase, user, profilo } = await requireAdmin();

  const meseCorrente = meseDaData(oggi());

  const { data: bambini } = await supabase
    .from('bambini')
    .select('id, nome, cognome')
    .eq('attiva', true);
  const bambinoIds = (bambini ?? []).map((b) => b.id);
  if (!bambinoIds.length) return { ok: false, messaggio: 'Nessun bambino attivo.' };

  const [{ data: costi }, { data: giaInviate }, { data: template }, { data: creditiDebiti }, dati, pastiEffettivi] =
    await Promise.all([
      supabase
        .from('costi_bambini')
        .select(`bambino_id, email_promemoria, ${COLONNE_COSTI_RIEPILOGO}`)
        .in('bambino_id', bambinoIds),
      supabase.from('comunicazioni_retta').select('bambino_id').eq('mese', meseCorrente).in('bambino_id', bambinoIds),
      supabase.from('impostazioni_email_retta').select('oggetto, corpo').eq('id', true).maybeSingle(),
      // specs/58: il credito/debito "da conteggiare" non è più un campo
      // del form (non modificabile in tabella) — il valore effettivamente
      // comunicato è sempre quello letto qui, mai quello del client.
      supabase
        .from('crediti_debiti_bambini')
        .select('bambino_id, importo, nota')
        .in('bambino_id', bambinoIds)
        .eq('mese_competenza', meseCorrente)
        .is('applicato_il', null),
      datiMese(supabase, meseCorrente),
      pastiEffettiviPerBambino(supabase, bambinoIds, mesePrecedente(meseCorrente)),
    ]);

  const costiPerBambino = new Map((costi ?? []).map((c) => [c.bambino_id, c]));
  const giaInviateSet = new Set((giaInviate ?? []).map((r) => r.bambino_id));
  const creditoDebitoPerBambino = new Map(
    (creditiDebiti ?? []).map((c) => [c.bambino_id, { importo: Number(c.importo), nota: c.nota }])
  );

  const inviataDaNome = `${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim() || user.email || 'Sconosciuto';
  const inviataDa = { id: user.id, nome: inviataDaNome };

  let inviate = 0;
  let ignorate = 0;

  for (const bambino of bambini ?? []) {
    if (giaInviateSet.has(bambino.id)) continue;

    const costiBambino = costiPerBambino.get(bambino.id);
    if (!costiBambino?.email_promemoria) {
      ignorate++;
      continue;
    }

    const noteExtra = ((formData.get(`note_extra_${bambino.id}`) as string) || '').trim() || null;
    const creditoDebito = creditoDebitoPerBambino.get(bambino.id);
    const notaCreditoDebito = creditoDebito?.nota ?? null;
    const riepilogo = riepilogoDalForm(
      formData,
      bambino.id,
      costiBambino,
      dati,
      pastiEffettivi.get(bambino.id) ?? 0,
      creditoDebito?.importo ?? 0
    );

    const riuscito = await inviaEPersistiComunicazione(
      supabase,
      bambino,
      costiBambino.email_promemoria,
      meseCorrente,
      riepilogo,
      numeriGettoniDalForm(formData, bambino.id),
      noteExtra,
      notaCreditoDebito,
      template,
      inviataDa,
      true
    );
    if (riuscito) {
      inviate++;
    } else {
      ignorate++;
    }
  }

  revalidatePath('/admin/rette');

  if (inviate === 0) {
    return {
      ok: false,
      messaggio:
        ignorate > 0
          ? `Nessuna comunicazione inviata: ${ignorate} bambini senza email configurata o con un errore di invio.`
          : 'Nessuna comunicazione da inviare: tutti i bambini attivi sono già stati comunicati questo mese.',
    };
  }
  if (ignorate > 0) {
    return {
      ok: false,
      messaggio: `Inviate ${inviate} comunicazioni. ${ignorate} bambini ignorati (email mancante o errore di invio).`,
    };
  }
  return { ok: true };
}

// Invio singolo (specs/56, scenario "inviare la comunicazione a un solo
// bambino con anteprima"): stessa logica di invio/registrazione
// dell'invio massivo, per un solo bambino scelto dall'admin. L'anteprima
// (a/oggetto/corpo) è già stata mostrata e confermata lato client
// (components/InvioSingoloRetta.tsx) prima che questo submit partisse:
// qui si ricontrollano comunque ammissibilità e si rilegge il riepilogo
// dal form, mai fidandosi ciecamente del client. formAction diretto
// (bind di bambinoId), non tramite useFormState — stesso motivo di
// annullaComunicazioneRetta sotto: niente <form> annidati nella tabella.
//
// `inviaMail` è fissato dalla pagina con bind (true per "Conferma invio",
// false per "Conferma senza inviare"), mai letto dal form: il valore di un
// pulsante submitter non arriva in modo affidabile alle Server Action.
export async function inviaComunicazioneRettaSingola(bambinoId: string, inviaMail: boolean, formData: FormData) {
  const { supabase, user, profilo } = await requireAdmin();

  const meseCorrente = meseDaData(oggi());

  const [{ data: bambino }, { data: costiBambino }, { data: giaInviata }, { data: template }, { data: creditoDebito }, dati, pastiEffettivi] =
    await Promise.all([
      supabase.from('bambini').select('id, nome, cognome').eq('id', bambinoId).eq('attiva', true).maybeSingle(),
      supabase
        .from('costi_bambini')
        .select(`email_promemoria, ${COLONNE_COSTI_RIEPILOGO}`)
        .eq('bambino_id', bambinoId)
        .maybeSingle(),
      supabase
        .from('comunicazioni_retta')
        .select('bambino_id')
        .eq('mese', meseCorrente)
        .eq('bambino_id', bambinoId)
        .maybeSingle(),
      supabase.from('impostazioni_email_retta').select('oggetto, corpo').eq('id', true).maybeSingle(),
      // specs/58: stesso motivo di inviaComunicazioniRetta sopra — il
      // credito/debito non è più un campo del form.
      supabase
        .from('crediti_debiti_bambini')
        .select('importo, nota')
        .eq('bambino_id', bambinoId)
        .eq('mese_competenza', meseCorrente)
        .is('applicato_il', null)
        .maybeSingle(),
      datiMese(supabase, meseCorrente),
      pastiEffettiviPerBambino(supabase, [bambinoId], mesePrecedente(meseCorrente)),
    ]);

  if (!bambino || giaInviata || !costiBambino?.email_promemoria) {
    return;
  }

  const noteExtra = ((formData.get(`note_extra_${bambinoId}`) as string) || '').trim() || null;
  const notaCreditoDebito = creditoDebito?.nota ?? null;
  const riepilogo = riepilogoDalForm(
    formData,
    bambinoId,
    costiBambino,
    dati,
    pastiEffettivi.get(bambinoId) ?? 0,
    creditoDebito ? Number(creditoDebito.importo) : 0
  );
  const inviataDaNome = `${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim() || user.email || 'Sconosciuto';

  await inviaEPersistiComunicazione(
    supabase,
    bambino,
    costiBambino.email_promemoria,
    meseCorrente,
    riepilogo,
    numeriGettoniDalForm(formData, bambinoId),
    noteExtra,
    notaCreditoDebito,
    template,
    { id: user.id, nome: inviataDaNome },
    inviaMail
  );

  revalidatePath('/admin/rette');
}

// Annulla l'invio di una comunicazione retta (specs/56, "Annulla
// invio"): elimina la riga di comunicazioni_retta per quel bambino e
// quel mese, liberando il vincolo unique così che il bambino torni tra
// quelli "da inviare" — nessuna nuova email, solo la cancellazione del
// log. Invocata come formAction diretto di un pulsante dentro al form
// "Invia comunicazioni" (bind di bambinoId/mese, non tramite
// useFormState: la tabella è già dentro un altro form con la propria
// azione, niente <form> annidati — vedi app/admin/rette/page.tsx), non
// restituisce un EsitoAzione: se la riga sparisce dalla tabella dopo il
// click l'annullamento è riuscito, stesso principio "l'effetto è la
// conferma" già usato altrove (specs/05 - feedback.md).
//
// specs/56, "'Annulla invio' resta disponibile solo finché il bonifico
// [...] è ancora 'da verificare'": un bonifico già marcato registra un
// pagamento reale, annullare cancellerebbe quella registrazione insieme
// alla comunicazione — il pulsante non compare nemmeno in pagina
// (RigaComunicazione), ma la guardia qui rifiuta comunque l'azione a
// chi la invocasse comunque (es. un form ormai disallineato dallo stato
// reale dopo un aggiornamento concorrente).
//
// specs/58, "annullare l'invio di una comunicazione libera di nuovo il
// credito/debito": un eventuale credito/debito applicato a questa
// comunicazione (stesso bambino, stesso mese di competenza) torna "da
// conteggiare" — no-op sicuro se non ce n'era nessuno.
export async function annullaComunicazioneRetta(bambinoId: string, mese: string, _formData: FormData) {
  const { supabase } = await requireAdmin();

  const { data: comunicazione } = await supabase
    .from('comunicazioni_retta')
    .select('id, bonifico_stato')
    .eq('bambino_id', bambinoId)
    .eq('mese', mese)
    .maybeSingle();
  if (!comunicazione || comunicazione.bonifico_stato !== 'in_attesa') return;

  await supabase.from('comunicazioni_retta').delete().eq('id', comunicazione.id);
  await supabase
    .from('crediti_debiti_bambini')
    .update({ applicato_il: null })
    .eq('bambino_id', bambinoId)
    .eq('mese_competenza', mese)
    .not('applicato_il', 'is', null);

  revalidatePath('/admin/rette');
}
