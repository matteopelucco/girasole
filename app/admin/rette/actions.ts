'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import {
  calcolaDifferenzaBonifico,
  formattaImporto,
  sostituisciPlaceholder,
  type RiepilogoRetta,
} from '@/lib/comunicazioneRetta';
import { emailsDaCampo } from '@/lib/costiBambino';
import { meseDaData, oggi, formattaMeseItaliano } from '@/lib/date';
import { destinatarioNotifiche, inviaEmail } from '@/lib/email';
import type { EsitoAzione } from '@/components/FormConEsito';

// Un importo non negativo (retta, pasti, marca da bollo, pre/post-
// asilo, extra): un valore vuoto/non numerico/negativo diventa 0,
// stesso pattern di app/admin/actions.ts (specs/55).
function importoEuro(valore: FormDataEntryValue | null): number {
  const numero = Number(valore);
  return Number.isFinite(numero) && numero >= 0 ? Math.round(numero * 100) / 100 : 0;
}

// Il conguaglio pasti è l'unica voce per natura negativa (un credito
// verso la famiglia, mai un addebito — specs/56): a differenza di
// importoEuro sopra, qui un numero negativo è legittimo e va
// preservato, non azzerato. Solo un valore non finito (vuoto, testo)
// diventa 0.
function importoConSegno(valore: FormDataEntryValue | null): number {
  const numero = Number(valore);
  return Number.isFinite(numero) ? Math.round(numero * 100) / 100 : 0;
}

// Voce di costo di un bambino al momento dell'invio (specs/56, scenario
// "modificare manualmente una voce di costo prima dell'invio"): costo
// pasti, conguaglio pasti, pre-asilo e post-asilo sono letti
// direttamente dai campi del form, MAI ricalcolati qui da presenze —
// l'admin può averli sovrascritti con una correzione ad-hoc prima di
// premere "Invia comunicazioni", ed è esattamente quel valore che deve
// finire nell'email e nel log. Retta e marca da bollo restano invece
// SEMPRE quelli di `costi_bambini` passati da chi chiama: non sono
// modificabili da questa tabella (retta si cambia solo sulla scheda del
// bambino, la marca da bollo non è modificabile da nessuna parte, è un
// importo fisso per legge — specs/56) e infatti non arrivano nel form.
// Funzione pura sulla FormData già ricevuta, nessun I/O: la
// "persistenza" delle eventuali modifiche avviene subito dopo, quando
// il chiamante scrive la riga in comunicazioni_retta (specs/56, "le
// modifiche non hanno un salvataggio separato").
function riepilogoDalForm(
  formData: FormData,
  bambinoId: string,
  rettaMensile: number,
  marcaDaBollo: number
): RiepilogoRetta {
  const costoPasti = importoEuro(formData.get(`costo_pasti_${bambinoId}`));
  const conguaglioPasti = importoConSegno(formData.get(`conguaglio_pasti_${bambinoId}`));
  const costoPreAsilo = importoEuro(formData.get(`pre_asilo_${bambinoId}`));
  const costoPostAsilo = importoEuro(formData.get(`post_asilo_${bambinoId}`));
  const costiExtra = importoEuro(formData.get(`costi_extra_${bambinoId}`));
  const creditoDebito = importoConSegno(formData.get(`credito_debito_${bambinoId}`));
  const totale =
    Math.round(
      (rettaMensile +
        costoPasti +
        conguaglioPasti +
        marcaDaBollo +
        costoPreAsilo +
        costoPostAsilo +
        costiExtra +
        creditoDebito) *
        100
    ) / 100;

  return {
    rettaMensile,
    costoPasti,
    conguaglioPasti,
    marcaDaBollo,
    costoPreAsilo,
    costoPostAsilo,
    costiExtra,
    creditoDebito,
    totale,
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
  noteExtra: string | null,
  notaCreditoDebito: string | null,
  template: TemplateRetta,
  inviataDa: { id: string; nome: string }
): Promise<boolean> {
  const valoriPlaceholder = placeholderRetta(bambino, mese, riepilogo, noteExtra, notaCreditoDebito);
  const oggetto = sostituisciPlaceholder(template?.oggetto ?? 'Promemoria retta {{mese}}', valoriPlaceholder);
  const corpoHtml = sostituisciPlaceholder(template?.corpo ?? '', valoriPlaceholder).replace(/\n/g, '<br>');

  try {
    // specs/55, "più indirizzi email di promemoria, separati da ;": un
    // solo invio, con tutti gli indirizzi come destinatari.
    await inviaEmail({ a: emailsDaCampo(email), cc: destinatarioNotifiche(), oggetto, html: corpoHtml });
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
// client. Gli IMPORTI invece sono quelli presenti nel form in quel
// momento (riepilogoDalForm sopra), non ricalcolati: ogni voce di costo
// è modificabile in pagina per una correzione ad-hoc, ed è quel valore
// che va comunicato e registrato. Il popup di conferma è lato client
// (components/PulsanteInvio.tsx, prop confermaMessaggio): se l'admin lo
// annulla, il form non viene nemmeno inviato, questa funzione non parte.
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

  const [{ data: costi }, { data: giaInviate }, { data: template }] = await Promise.all([
    supabase
      .from('costi_bambini')
      .select('bambino_id, email_promemoria, prezzo_mensile, prezzo_marca_da_bollo')
      .in('bambino_id', bambinoIds),
    supabase.from('comunicazioni_retta').select('bambino_id').eq('mese', meseCorrente).in('bambino_id', bambinoIds),
    supabase.from('impostazioni_email_retta').select('oggetto, corpo').eq('id', true).maybeSingle(),
  ]);

  const costiPerBambino = new Map((costi ?? []).map((c) => [c.bambino_id, c]));
  const giaInviateSet = new Set((giaInviate ?? []).map((r) => r.bambino_id));

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
    const notaCreditoDebito = ((formData.get(`nota_credito_debito_${bambino.id}`) as string) || '').trim() || null;
    const riepilogo = riepilogoDalForm(
      formData,
      bambino.id,
      Number(costiBambino.prezzo_mensile),
      Number(costiBambino.prezzo_marca_da_bollo)
    );

    const riuscito = await inviaEPersistiComunicazione(
      supabase,
      bambino,
      costiBambino.email_promemoria,
      meseCorrente,
      riepilogo,
      noteExtra,
      notaCreditoDebito,
      template,
      inviataDa
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
export async function inviaComunicazioneRettaSingola(bambinoId: string, formData: FormData) {
  const { supabase, user, profilo } = await requireAdmin();

  const meseCorrente = meseDaData(oggi());

  const [{ data: bambino }, { data: costiBambino }, { data: giaInviata }, { data: template }] = await Promise.all([
    supabase.from('bambini').select('id, nome, cognome').eq('id', bambinoId).eq('attiva', true).maybeSingle(),
    supabase
      .from('costi_bambini')
      .select('email_promemoria, prezzo_mensile, prezzo_marca_da_bollo')
      .eq('bambino_id', bambinoId)
      .maybeSingle(),
    supabase.from('comunicazioni_retta').select('bambino_id').eq('mese', meseCorrente).eq('bambino_id', bambinoId).maybeSingle(),
    supabase.from('impostazioni_email_retta').select('oggetto, corpo').eq('id', true).maybeSingle(),
  ]);

  if (!bambino || giaInviata || !costiBambino?.email_promemoria) {
    return;
  }

  const noteExtra = ((formData.get(`note_extra_${bambinoId}`) as string) || '').trim() || null;
  const notaCreditoDebito = ((formData.get(`nota_credito_debito_${bambinoId}`) as string) || '').trim() || null;
  const riepilogo = riepilogoDalForm(
    formData,
    bambinoId,
    Number(costiBambino.prezzo_mensile),
    Number(costiBambino.prezzo_marca_da_bollo)
  );
  const inviataDaNome = `${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim() || user.email || 'Sconosciuto';

  await inviaEPersistiComunicazione(
    supabase,
    bambino,
    costiBambino.email_promemoria,
    meseCorrente,
    riepilogo,
    noteExtra,
    notaCreditoDebito,
    template,
    { id: user.id, nome: inviataDaNome }
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

// Recupera una comunicazione ancora "da verificare" (specs/59): stesso
// controllo per "Bonifico corretto" e "Importo diverso", estratto per
// non duplicarlo (CLAUDE.md, jscpd).
async function comunicazioneDaVerificare(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  comunicazioneId: string
): Promise<{ ok: true; totale: number } | { ok: false; errore: EsitoAzione }> {
  const { data: comunicazione } = await supabase
    .from('comunicazioni_retta')
    .select('totale, bonifico_stato')
    .eq('id', comunicazioneId)
    .maybeSingle();
  if (!comunicazione) {
    return { ok: false, errore: { ok: false, messaggio: 'Comunicazione non trovata.' } };
  }
  if (comunicazione.bonifico_stato !== 'in_attesa') {
    return {
      ok: false,
      errore: { ok: false, messaggio: 'Il bonifico di questa comunicazione è già stato verificato.' },
    };
  }
  return { ok: true, totale: Number(comunicazione.totale) };
}

// Registra l'esito della verifica sulla comunicazione (specs/59): stesso
// update/gestione errore/revalidate per "corretto" e "importo diverso",
// estratto per non duplicarlo (CLAUDE.md, jscpd) — cambiano solo i tre
// campi passati in `esito`.
async function registraVerificaBonifico(
  supabase: Awaited<ReturnType<typeof requireAdmin>>['supabase'],
  comunicazioneId: string,
  esito: { stato: 'corretto' | 'importo_errato'; importoRicevuto: number; nota: string | null },
  verificatoDa: { id: string; nome: string }
): Promise<EsitoAzione> {
  const { error } = await supabase
    .from('comunicazioni_retta')
    .update({
      bonifico_stato: esito.stato,
      bonifico_importo_ricevuto: esito.importoRicevuto,
      bonifico_nota: esito.nota,
      bonifico_verificato_da: verificatoDa.id,
      bonifico_verificato_da_nome: verificatoDa.nome,
      bonifico_verificato_il: new Date().toISOString(),
    })
    .eq('id', comunicazioneId);
  if (error) {
    return { ok: false, messaggio: 'Impossibile registrare la verifica del bonifico.', dettaglio: error.message };
  }

  revalidatePath('/admin/rette');
  return { ok: true };
}

// specs/59 - verifica-bonifico-retta.md, scenario "marcare un bonifico
// come corretto": l'importo ricevuto è per definizione quello atteso
// (comunicazioni_retta.totale), nessuna nota, nessun credito/debito
// generato. Stesso schema di FormConEsito/useFormState di
// aggiungiCreditoDebito sopra (non il "formAction diretto" di
// annullaComunicazioneRetta) perché deve funzionare anche fuori dal
// form "Invia comunicazioni" — su un mese passato, in sola lettura per
// invio/annullo, la verifica del bonifico resta comunque possibile
// (specs/59, "verificare il bonifico anche su un mese passato"): ogni
// riga ha quindi il proprio `<form>` indipendente
// (components/VerificaBonifico.tsx), niente da annidare in nessun altro
// form. `comunicazioneId` è già "bindato" dal chiamante (vedi
// VerificaBonifico), coerente con l'uso di `.bind()` con
// `useFormState` — gli argomenti bindati precedono lo stato e la
// FormData nella firma.
export async function marcaBonificoCorretto(
  comunicazioneId: string,
  _stato: EsitoAzione,
  _formData: FormData
): Promise<EsitoAzione> {
  const { supabase, user, profilo } = await requireAdmin();

  const comunicazione = await comunicazioneDaVerificare(supabase, comunicazioneId);
  if (!comunicazione.ok) return comunicazione.errore;

  const verificatoDaNome = `${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim() || user.email || 'Sconosciuto';
  return registraVerificaBonifico(
    supabase,
    comunicazioneId,
    { stato: 'corretto', importoRicevuto: comunicazione.totale, nota: null },
    { id: user.id, nome: verificatoDaNome }
  );
}

// specs/59, scenario "marcare un bonifico con importo diverso da
// quello atteso": richiede l'importo realmente ricevuto e una nota
// obbligatoria, genera un credito/debito (specs/58) sul bambino per il
// mese scelto pari alla differenza (positiva = debito, negativa =
// credito — calcolaDifferenzaBonifico, lib/comunicazioneRetta.ts),
// tranne quando la differenza è zero (l'admin ha comunque voluto
// lasciare una nota, ma non c'è nulla da conteggiare).
export async function marcaBonificoImportoErrato(
  comunicazioneId: string,
  bambinoId: string,
  _stato: EsitoAzione,
  formData: FormData
): Promise<EsitoAzione> {
  const { supabase, user, profilo } = await requireAdmin();

  const importoRicevuto = Number(formData.get('importo_ricevuto'));
  const nota = ((formData.get('nota') as string) || '').trim();
  const meseCompetenza = (formData.get('mese_competenza') as string) || '';

  if (!Number.isFinite(importoRicevuto) || importoRicevuto < 0) {
    return { ok: false, messaggio: "Inserisci l'importo realmente ricevuto." };
  }
  if (!nota) {
    return { ok: false, messaggio: 'Scrivi una nota che spieghi la differenza.' };
  }
  if (!/^\d{4}-\d{2}$/.test(meseCompetenza)) {
    return { ok: false, messaggio: 'Scegli un mese valido su cui conteggiare la differenza.' };
  }
  const meseCorrente = meseDaData(oggi());
  if (meseCompetenza < meseCorrente) {
    return { ok: false, messaggio: 'Il mese scelto non può essere precedente al mese corrente.' };
  }

  const comunicazione = await comunicazioneDaVerificare(supabase, comunicazioneId);
  if (!comunicazione.ok) return comunicazione.errore;

  const verificatoDaNome = `${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim() || user.email || 'Sconosciuto';
  const differenza = calcolaDifferenzaBonifico(comunicazione.totale, importoRicevuto);

  if (differenza !== 0) {
    const { error: erroreCredito } = await supabase.from('crediti_debiti_bambini').insert({
      bambino_id: bambinoId,
      mese_competenza: meseCompetenza,
      importo: differenza,
      nota,
      origine: 'bonifico',
      creato_da: user.id,
      creato_da_nome: verificatoDaNome,
    });
    if (erroreCredito) {
      if (erroreCredito.code === '23505') {
        return {
          ok: false,
          messaggio: `Esiste già un credito/debito da conteggiare per ${formattaMeseItaliano(
            meseCompetenza
          )} su questo bambino: scegli un altro mese, oppure intervieni prima su quello esistente dalla sua scheda.`,
        };
      }
      return {
        ok: false,
        messaggio: 'Impossibile registrare il credito/debito generato dal bonifico.',
        dettaglio: erroreCredito.message,
      };
    }
  }

  const esito = await registraVerificaBonifico(
    supabase,
    comunicazioneId,
    { stato: 'importo_errato', importoRicevuto, nota },
    { id: user.id, nome: verificatoDaNome }
  );
  if (esito.ok) revalidatePath(`/admin/bambini/${bambinoId}`);
  return esito;
}

// specs/59, scenari "annullare la verifica di un bonifico marcato
// corretto/con importo diverso": riporta il bonifico "da verificare"
// (stesso stato di prima di qualunque decisione), per correggere un
// click sbagliato. Non tocca in nessun caso un eventuale
// credito/debito generato da "Importo diverso" (specs/58, "annullare
// l'invio di una comunicazione libera di nuovo il credito/debito" è
// l'unico caso che lo fa, e qui non si sta annullando l'invio): il
// chiamante (components/VerificaBonifico.tsx) è responsabile di
// avvisare l'admin di ricontrollarlo a mano quando lo stato annullato
// era "importo_errato" — l'unico dato che serve per deciderlo (lo
// stato prima del reset) è già noto lato client, nessun bisogno che il
// server lo rimandi indietro.
export async function resettaVerificaBonifico(
  comunicazioneId: string,
  _stato: EsitoAzione,
  _formData: FormData
): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();

  const { data: comunicazione } = await supabase
    .from('comunicazioni_retta')
    .select('bonifico_stato')
    .eq('id', comunicazioneId)
    .maybeSingle();
  if (!comunicazione) return { ok: false, messaggio: 'Comunicazione non trovata.' };
  if (comunicazione.bonifico_stato === 'in_attesa') {
    return { ok: false, messaggio: 'Il bonifico di questa comunicazione è già da verificare.' };
  }

  const { error } = await supabase
    .from('comunicazioni_retta')
    .update({
      bonifico_stato: 'in_attesa',
      bonifico_importo_ricevuto: null,
      bonifico_nota: null,
      bonifico_verificato_da: null,
      bonifico_verificato_da_nome: null,
      bonifico_verificato_il: null,
    })
    .eq('id', comunicazioneId);
  if (error) {
    return { ok: false, messaggio: 'Impossibile annullare la verifica del bonifico.', dettaglio: error.message };
  }

  revalidatePath('/admin/rette');
  return { ok: true };
}
