'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { calcolaDifferenzaBonifico, formattaImporto } from '@/lib/comunicazioneRetta';
import { formattaMeseItaliano, meseDaData, oggi } from '@/lib/date';
import { normalizzaNotaPagamento } from '@/lib/pagamentiBambino';
import type { EsitoAzione } from '@/components/FormConEsito';

// Azioni di "Pagamenti bambino" (specs/59 verifica del bonifico, specs/60 nota
// per riga). Spostate qui da app/admin/rette/actions.ts (issue #417): ogni
// azione ricontrolla `requireAdmin` sul server, con la sessione dell'admin
// (RLS), mai con chiavi di servizio.

// Dopo una modifica si aggiornano sia questa pagina sia "Rette", che mostra lo
// stato del bonifico in sola lettura.
function revalidaPagine() {
  revalidatePath('/admin/pagamenti-bambino');
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

  revalidaPagine();
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

  revalidaPagine();
  return { ok: true };
}

// specs/60, PAG-05..PAG-08: salva la nota privata di una riga (mese già
// comunicato). Scrive solo `nota_pagamento`: `bonifico_nota` e lo stato del
// bonifico non si toccano mai. Una nota vuota la cancella (null); oltre 500
// caratteri è un errore (c'è anche il CHECK nel database). Non compare mai
// nell'email ai genitori né nel PDF: quelli non leggono questa colonna.
export async function salvaNotaPagamento(
  comunicazioneId: string,
  _stato: EsitoAzione,
  formData: FormData
): Promise<EsitoAzione> {
  const { supabase } = await requireAdmin();

  const testo = formData.get('nota');
  const nota = normalizzaNotaPagamento(typeof testo === 'string' ? testo : null);
  if (!nota.ok) return { ok: false, messaggio: nota.messaggio };

  const { data, error } = await supabase
    .from('comunicazioni_retta')
    .update({ nota_pagamento: nota.valore })
    .eq('id', comunicazioneId)
    .select('id');
  if (error) {
    return { ok: false, messaggio: 'Impossibile salvare la nota.', dettaglio: error.message };
  }
  if (!data || data.length === 0) return { ok: false, messaggio: 'Comunicazione non trovata.' };

  revalidaPagine();
  return { ok: true };
}
