'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { formattaImporto, sostituisciPlaceholder, type RiepilogoRetta } from '@/lib/comunicazioneRetta';
import { meseDaData, oggi, formattaMeseItaliano } from '@/lib/date';
import { inviaEmail } from '@/lib/email';
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

// Voce di costo di un bambino così come compilata nel form al momento
// dell'invio (specs/56, scenario "modificare manualmente una voce di
// costo prima dell'invio"): letta direttamente dai campi del form,
// MAI ricalcolata qui da costi_bambini/presenze — quei dati servono
// solo a precompilare la pagina (app/admin/rette/page.tsx), l'admin può
// averli sovrascritti con una correzione ad-hoc prima di premere "Invia
// comunicazioni", ed è esattamente quel valore che deve finire
// nell'email e nel log. Funzione pura sulla FormData già ricevuta,
// nessun I/O: la "persistenza" delle eventuali modifiche avviene subito
// dopo, quando il chiamante scrive la riga in comunicazioni_retta
// (specs/56, "le modifiche non hanno un salvataggio separato").
function riepilogoDalForm(formData: FormData, bambinoId: string): RiepilogoRetta {
  const rettaMensile = importoEuro(formData.get(`retta_${bambinoId}`));
  const costoPasti = importoEuro(formData.get(`costo_pasti_${bambinoId}`));
  const conguaglioPasti = importoConSegno(formData.get(`conguaglio_pasti_${bambinoId}`));
  const marcaDaBollo = importoEuro(formData.get(`marca_da_bollo_${bambinoId}`));
  const costoPreAsilo = importoEuro(formData.get(`pre_asilo_${bambinoId}`));
  const costoPostAsilo = importoEuro(formData.get(`post_asilo_${bambinoId}`));
  const costiExtra = importoEuro(formData.get(`costi_extra_${bambinoId}`));
  const totale =
    Math.round((rettaMensile + costoPasti + conguaglioPasti + marcaDaBollo + costoPreAsilo + costoPostAsilo + costiExtra) * 100) /
    100;

  return { rettaMensile, costoPasti, conguaglioPasti, marcaDaBollo, costoPreAsilo, costoPostAsilo, costiExtra, totale };
}

// Placeholder sostituiti nel template della mail (specs/56), a partire
// da un riepilogo già letto dal form (mai ricalcolato). Funzione pura,
// nessun I/O: condivisa dall'invio massivo e da quello singolo per non
// duplicare la stessa costruzione due volte (CLAUDE.md, jscpd).
function placeholderRetta(
  bambino: { nome: string; cognome: string },
  mese: string,
  riepilogo: RiepilogoRetta
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
  template: TemplateRetta,
  inviataDa: { id: string; nome: string }
): Promise<boolean> {
  const valoriPlaceholder = placeholderRetta(bambino, mese, riepilogo);
  const oggetto = sostituisciPlaceholder(template?.oggetto ?? 'Promemoria retta {{mese}}', valoriPlaceholder);
  const corpoHtml = sostituisciPlaceholder(template?.corpo ?? '', valoriPlaceholder).replace(/\n/g, '<br>');

  try {
    await inviaEmail({ a: email, oggetto, html: corpoHtml });
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
    totale: riepilogo.totale,
    email_destinatario: email,
    inviata_da: inviataDa.id,
    inviata_da_nome: inviataDa.nome,
  });

  return !erroreLog;
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
    supabase.from('costi_bambini').select('bambino_id, email_promemoria').in('bambino_id', bambinoIds),
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
    const riepilogo = riepilogoDalForm(formData, bambino.id);

    const riuscito = await inviaEPersistiComunicazione(
      supabase,
      bambino,
      costiBambino.email_promemoria,
      meseCorrente,
      riepilogo,
      noteExtra,
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
    supabase.from('costi_bambini').select('email_promemoria').eq('bambino_id', bambinoId).maybeSingle(),
    supabase.from('comunicazioni_retta').select('bambino_id').eq('mese', meseCorrente).eq('bambino_id', bambinoId).maybeSingle(),
    supabase.from('impostazioni_email_retta').select('oggetto, corpo').eq('id', true).maybeSingle(),
  ]);

  if (!bambino || giaInviata || !costiBambino?.email_promemoria) {
    return;
  }

  const noteExtra = ((formData.get(`note_extra_${bambinoId}`) as string) || '').trim() || null;
  const riepilogo = riepilogoDalForm(formData, bambinoId);
  const inviataDaNome = `${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim() || user.email || 'Sconosciuto';

  await inviaEPersistiComunicazione(
    supabase,
    bambino,
    costiBambino.email_promemoria,
    meseCorrente,
    riepilogo,
    noteExtra,
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
export async function annullaComunicazioneRetta(bambinoId: string, mese: string, _formData: FormData) {
  const { supabase } = await requireAdmin();

  await supabase.from('comunicazioni_retta').delete().eq('bambino_id', bambinoId).eq('mese', mese);

  revalidatePath('/admin/rette');
}
