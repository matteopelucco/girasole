'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { emailListaValida } from '@/lib/costiBambino';
import { formattaMeseItaliano, meseDaData, oggi } from '@/lib/date';
import { leggiTipoSezione, parseImportoOpzionale } from '@/lib/prezzi';
import type { EsitoAzione } from '@/components/FormConEsito';
import type { StatoImporti } from '@/components/FormImporti';

export async function creaSezione(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const nome = (formData.get('nome') as string)?.trim();
  const annoScolasticoId = (formData.get('anno_scolastico_id') as string) || null;

  if (!nome) return { ok: false, messaggio: 'Inserisci un nome per la sezione.' };

  // Tipo facoltativo (specs/50 AMM-01): "" = Nessuno. Un valore che non sia
  // un tipo noto è rifiutato, non trasformato in "nessun tipo".
  const tipo = leggiTipoSezione(formData.get('tipo'));
  if (!tipo.ok) return { ok: false, messaggio: 'Scegli un tipo di sezione valido.' };

  const { error } = await supabase
    .from('sezioni')
    .insert({ nome, anno_scolastico_id: annoScolasticoId, tipo: tipo.tipo });
  if (error) {
    return { ok: false, messaggio: 'Impossibile creare la sezione.', dettaglio: error.message };
  }

  revalidatePath('/admin');
  return { ok: true };
}

// specs/50 AMM-02: cambia il tipo di una sezione. Non tocca bambini né costi:
// vale per i bambini creati dopo e per la retta proposta a chi non ha ancora i
// costi salvati.
export async function aggiornaTipoSezione(
  _stato: EsitoAzione,
  formData: FormData
): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const sezioneId = formData.get('sezione_id') as string;
  const tipo = leggiTipoSezione(formData.get('tipo'));

  if (!sezioneId) return { ok: false, messaggio: 'Sezione non valida.' };
  if (!tipo.ok) return { ok: false, messaggio: 'Scegli un tipo di sezione valido.' };

  const { data, error } = await supabase
    .from('sezioni')
    .update({ tipo: tipo.tipo })
    .eq('id', sezioneId)
    .select('id');
  if (error) {
    return { ok: false, messaggio: 'Impossibile aggiornare il tipo della sezione.', dettaglio: error.message };
  }
  if (!data?.length) return { ok: false, messaggio: 'Sezione non trovata.' };

  revalidatePath('/admin');
  return { ok: true };
}

export async function toggleAttivaSezione(
  _stato: EsitoAzione,
  formData: FormData
): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const sezioneId = formData.get('sezione_id') as string;
  const attivaAttuale = formData.get('attiva_attuale') === 'true';

  if (!sezioneId) return { ok: false, messaggio: 'Sezione non valida.' };

  const { error } = await supabase
    .from('sezioni')
    .update({ attiva: !attivaAttuale })
    .eq('id', sezioneId);
  if (error) {
    return {
      ok: false,
      messaggio: 'Impossibile aggiornare lo stato della sezione.',
      dettaglio: error.message,
    };
  }

  revalidatePath('/admin');
  return { ok: true };
}

export async function creaAnnoScolastico(
  _stato: EsitoAzione,
  formData: FormData
): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const nome = (formData.get('nome') as string)?.trim();

  if (!nome) return { ok: false, messaggio: "Inserisci un nome per l'anno scolastico." };

  const { error } = await supabase.from('anni_scolastici').insert({ nome });
  if (error) {
    return {
      ok: false,
      messaggio: "Impossibile creare l'anno scolastico.",
      dettaglio: error.message,
    };
  }

  revalidatePath('/admin');
  return { ok: true };
}

// Campi condivisi da creazione e modifica di un bambino (specs/50).
function campiBambino(formData: FormData) {
  return {
    nome: ((formData.get('nome') as string) || '').trim(),
    cognome: ((formData.get('cognome') as string) || '').trim(),
    sezioneId: (formData.get('sezione_id') as string) || null,
    dataNascita: (formData.get('data_nascita') as string) || null,
    sesso: (formData.get('sesso') as string) || null,
    noteAllergie: ((formData.get('note_allergie') as string) || '').trim() || null,
    altreNote: ((formData.get('altre_note') as string) || '').trim() || null,
  };
}

function esitoErroreBambino(error: { code?: string; message: string }): EsitoAzione {
  if (error.code === '23505') {
    return {
      ok: false,
      messaggio: 'Esiste già un alunno con questo nome, cognome e data di nascita.',
    };
  }
  return { ok: false, messaggio: 'Impossibile salvare il bambino.', dettaglio: error.message };
}

export async function creaBambino(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const { nome, cognome, sezioneId, dataNascita, sesso, noteAllergie, altreNote } =
    campiBambino(formData);

  if (!nome || !cognome) {
    return { ok: false, messaggio: 'Compila nome e cognome del bambino.' };
  }

  // Bambino e, se la sezione ha un tipo, la sua riga di costi nascono insieme
  // in un'unica operazione del database (specs/50 AMM-03, AMM-05): se i costi
  // non si scrivono, non resta nemmeno il bambino. Senza sezione o senza tipo
  // nasce solo il bambino (AMM-04). Migration 0067.
  const { error } = await supabase.rpc('crea_bambino_con_costi', {
    p_nome: nome,
    p_cognome: cognome,
    p_sezione_id: sezioneId,
    p_data_nascita: dataNascita,
    p_sesso: sesso,
    p_note_allergie: noteAllergie,
    p_altre_note: altreNote,
  });
  if (error) return esitoErroreBambino(error);

  revalidatePath('/admin');
  return { ok: true };
}

// specs/50 - amministrazione_base.md, scenario "modificare i dati di un bambino".
export async function aggiornaBambino(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const bambinoId = formData.get('bambino_id') as string;
  const { nome, cognome, sezioneId, dataNascita, sesso, noteAllergie, altreNote } =
    campiBambino(formData);

  if (!bambinoId || !nome || !cognome) {
    return { ok: false, messaggio: 'Compila nome e cognome del bambino.' };
  }

  const { error } = await supabase
    .from('bambini')
    .update({
      nome,
      cognome,
      sezione_id: sezioneId,
      data_nascita: dataNascita,
      sesso,
      note_allergie: noteAllergie,
      altre_note: altreNote,
      // Effetto visibile della conferma (specs/05 - feedback.md): i
      // campi del form restano con gli stessi valori appena scritti,
      // senza questo timestamp non ci sarebbe modo di accorgersi che
      // il salvataggio è davvero avvenuto (stesso pattern di
      // app/admin/rette/template/actions.ts, "Ultimo salvataggio").
      updated_at: new Date().toISOString(),
    })
    .eq('id', bambinoId);
  if (error) return esitoErroreBambino(error);

  revalidatePath(`/admin/bambini/${bambinoId}`);
  revalidatePath('/admin');
  return { ok: true };
}

// specs/50 - amministrazione_base.md, scenario "disattivare e riattivare
// un bambino": non cancella nulla, filtra solo la sua visibilità
// nell'elenco della classe e nelle funzioni Presenze/Pasto (vedi
// lib/sezioni.ts per lo stesso pattern già usato con sezioni.attiva).
export async function toggleAttivaBambino(
  _stato: EsitoAzione,
  formData: FormData
): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const bambinoId = formData.get('bambino_id') as string;
  const attivaAttuale = formData.get('attiva_attuale') === 'true';

  if (!bambinoId) return { ok: false, messaggio: 'Bambino non valido.' };

  const { error } = await supabase
    .from('bambini')
    .update({ attiva: !attivaAttuale })
    .eq('id', bambinoId);
  if (error) {
    return {
      ok: false,
      messaggio: 'Impossibile aggiornare lo stato del bambino.',
      dettaglio: error.message,
    };
  }

  revalidatePath(`/admin/bambini/${bambinoId}`);
  revalidatePath('/admin');
  return { ok: true };
}

// Campi di prezzo della scheda Costi (specs/55): il nome del campo del form è
// anche la colonna di `costi_bambini`.
const CAMPI_COSTI = [
  'prezzo_mensile',
  'prezzo_buono_pasto',
  'prezzo_marca_da_bollo',
  'prezzo_pre_asilo',
  'prezzo_post_asilo',
] as const;

// specs/55 - costi-bambino.md (COS-01, COS-05): prezzo retta, prezzo buono
// pasto, marca da bollo, abbonamento pre-asilo/post-asilo ed email di
// promemoria per un bambino. Upsert su bambino_id: la prima conferma crea la
// riga, le successive la aggiornano. Ogni prezzo passa da
// `parseImportoOpzionale`: vuoto = 0 ("nessun importo previsto"); un valore non
// numerico, negativo, con più di due decimali o sopra 9999,99 è rifiutato con
// un messaggio sul campo e NON si salva nulla (mai trasformato in 0 in silenzio).
export async function aggiornaCostiBambino(
  _stato: StatoImporti,
  formData: FormData
): Promise<StatoImporti> {
  const { supabase } = await requireAdmin();
  const bambinoId = formData.get('bambino_id') as string;
  const preAsiloRichiesto = formData.get('pre_asilo_richiesto') === 'on';
  const postAsiloRichiesto = formData.get('post_asilo_richiesto') === 'on';
  const emailPromemoria = ((formData.get('email_promemoria') as string) || '').trim();

  if (!bambinoId) return { esito: 'errore', messaggio: 'Bambino non valido.' };

  const valori: Record<string, number> = {};
  const errori: Record<string, string> = {};
  for (const campo of CAMPI_COSTI) {
    const grezzo = formData.get(campo);
    const esito = parseImportoOpzionale(typeof grezzo === 'string' ? grezzo : '');
    if (esito.ok) valori[campo] = esito.valore;
    else errori[campo] = esito.errore;
  }
  if (Object.keys(errori).length > 0) return { esito: 'errore', errori };

  if (emailPromemoria && !emailListaValida(emailPromemoria)) {
    return {
      esito: 'errore',
      messaggio:
        "Inserisci uno o più indirizzi email validi per il promemoria (separati da \";\"), oppure lascia il campo vuoto.",
    };
  }

  const { error } = await supabase.from('costi_bambini').upsert({
    bambino_id: bambinoId,
    ...valori,
    pre_asilo_richiesto: preAsiloRichiesto,
    post_asilo_richiesto: postAsiloRichiesto,
    email_promemoria: emailPromemoria || null,
    // Senza questo campo esplicito, upsert lascia `updated_at` al
    // default (solo insert) invariato sui salvataggi successivi — la
    // pagina non avrebbe modo di mostrare "Ultimo salvataggio" come
    // effetto visibile della conferma (specs/05 - feedback.md, stesso
    // pattern di app/admin/rette/template/actions.ts).
    updated_at: new Date().toISOString(),
  });
  if (error) {
    return { esito: 'errore', messaggio: 'Impossibile salvare i costi.', dettaglio: error.message };
  }

  revalidatePath(`/admin/bambini/${bambinoId}`);
  revalidatePath('/admin/rette');
  return { esito: 'salvato' };
}

// specs/58 - crediti-debiti-bambino.md, scenario "aggiungere un
// credito o un debito dalla scheda del bambino": importo sempre
// positivo in ingresso (il segno lo sceglie l'admin con "tipo"), nota
// obbligatoria, mese di competenza mai precedente al mese corrente
// (un mese già trascorso ha già la sua comunicazione, o non ne avrà
// mai una nuova — Regole del requisito). L'unicità "un solo
// credito/debito da conteggiare per bambino e mese" è imposta anche a
// livello di indice (0041_crediti_debiti_bambini.sql,
// crediti_debiti_bambini_pendenti_uniq): la violazione (codice
// Postgres 23505) diventa qui un messaggio comprensibile invece
// dell'errore tecnico grezzo.
export async function aggiungiCreditoDebito(
  _stato: EsitoAzione,
  formData: FormData
): Promise<EsitoAzione> {
  const { supabase, user, profilo } = await requireAdmin();
  const bambinoId = formData.get('bambino_id') as string;
  const tipo = formData.get('tipo') as string;
  const importoPositivo = Number(formData.get('importo'));
  const meseCompetenza = (formData.get('mese_competenza') as string) || '';
  const nota = ((formData.get('nota') as string) || '').trim();

  if (!bambinoId) return { ok: false, messaggio: 'Bambino non valido.' };
  if (tipo !== 'credito' && tipo !== 'debito') {
    return { ok: false, messaggio: 'Scegli se è un credito o un debito.' };
  }
  if (!Number.isFinite(importoPositivo) || importoPositivo <= 0) {
    return { ok: false, messaggio: "Inserisci un importo maggiore di zero." };
  }
  if (!/^\d{4}-\d{2}$/.test(meseCompetenza)) {
    return { ok: false, messaggio: 'Scegli un mese di competenza valido.' };
  }
  const meseCorrente = meseDaData(oggi());
  if (meseCompetenza < meseCorrente) {
    return { ok: false, messaggio: 'Il mese di competenza non può essere precedente al mese corrente.' };
  }
  if (!nota) {
    return { ok: false, messaggio: 'Scrivi una nota che spieghi il motivo del credito/debito.' };
  }

  const importoConSegno = Math.round((tipo === 'credito' ? -importoPositivo : importoPositivo) * 100) / 100;
  const creatoDaNome = `${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim() || user.email || 'Sconosciuto';

  const { error } = await supabase.from('crediti_debiti_bambini').insert({
    bambino_id: bambinoId,
    mese_competenza: meseCompetenza,
    importo: importoConSegno,
    nota,
    creato_da: user.id,
    creato_da_nome: creatoDaNome,
  });
  if (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        messaggio: `Esiste già un credito/debito da conteggiare per ${formattaMeseItaliano(
          meseCompetenza
        )} su questo bambino: modificalo o eliminalo dall'elenco, oppure scegli un altro mese.`,
      };
    }
    return { ok: false, messaggio: 'Impossibile salvare il credito/debito.', dettaglio: error.message };
  }

  revalidatePath(`/admin/bambini/${bambinoId}`);
  revalidatePath('/admin/rette');
  return { ok: true };
}

// specs/58, scenario "un credito o debito non ancora applicato può
// essere eliminato": la policy RLS di delete
// (crediti_debiti_bambini_admin_delete) già rifiuta la riga se
// applicato_il non è più null, quindi il .eq qui sotto basta — nessun
// controllo aggiuntivo necessario lato applicazione.
export async function eliminaCreditoDebito(
  _stato: EsitoAzione,
  formData: FormData
): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const id = formData.get('id') as string;
  const bambinoId = formData.get('bambino_id') as string;

  if (!id || !bambinoId) return { ok: false, messaggio: 'Credito/debito non valido.' };

  const { error } = await supabase.from('crediti_debiti_bambini').delete().eq('id', id);
  if (error) {
    return { ok: false, messaggio: 'Impossibile eliminare il credito/debito.', dettaglio: error.message };
  }

  revalidatePath(`/admin/bambini/${bambinoId}`);
  revalidatePath('/admin/rette');
  return { ok: true };
}

// specs/50 - amministrazione_base.md, scenario "assegnare rapidamente
// una sezione a un bambino senza classe": riattiva anche il bambino, se
// era disattivato — assegnargli una classe implica volerlo di nuovo
// operativo.
export async function assegnaSezioneBambino(
  _stato: EsitoAzione,
  formData: FormData
): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();
  const bambinoId = formData.get('bambino_id') as string;
  const sezioneId = formData.get('sezione_id') as string;

  if (!bambinoId || !sezioneId) {
    return { ok: false, messaggio: 'Scegli una sezione da assegnare.' };
  }

  const { error } = await supabase
    .from('bambini')
    .update({ sezione_id: sezioneId, attiva: true })
    .eq('id', bambinoId);
  if (error) {
    return { ok: false, messaggio: 'Impossibile assegnare la sezione.', dettaglio: error.message };
  }

  revalidatePath('/admin');
  return { ok: true };
}
