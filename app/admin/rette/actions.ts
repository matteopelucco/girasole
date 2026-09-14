'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { chiusurePerPeriodo } from '@/lib/calendarioScolastico';
import {
  calcolaRiepilogoRetta,
  formattaImporto,
  giorniAperturaMese,
  sostituisciPlaceholder,
} from '@/lib/comunicazioneRetta';
import { meseDaData, mesePrecedente, oggi, primoGiornoMese, ultimoGiornoMese, formattaMeseItaliano } from '@/lib/date';
import { inviaEmail } from '@/lib/email';
import type { EsitoAzione } from '@/components/FormConEsito';

function importoEuro(valore: FormDataEntryValue | null): number {
  const numero = Number(valore);
  return Number.isFinite(numero) && numero >= 0 ? Math.round(numero * 100) / 100 : 0;
}

// specs/56 - comunicazione-retta-mensile.md, scenario "inviare le
// comunicazioni con un click": ricalcola tutto lato server (non si fida
// dei valori mostrati in pagina, tranne i costi extra/nota inseriti
// dall'admin) e determina da sé chi è ammesso all'invio — bambino
// attivo, con costi ed email configurati (specs/55), non ancora
// comunicato questo mese — invece di fidarsi di un elenco arrivato dal
// client.
export async function inviaComunicazioniRetta(
  _stato: EsitoAzione,
  formData: FormData
): Promise<EsitoAzione> {
  const { supabase, user, profilo } = await requireAdmin();

  const meseCorrente = meseDaData(oggi());
  const mesePrecedenteValore = mesePrecedente(meseCorrente);

  const { data: bambini } = await supabase
    .from('bambini')
    .select('id, nome, cognome')
    .eq('attiva', true);
  const bambinoIds = (bambini ?? []).map((b) => b.id);
  if (!bambinoIds.length) return { ok: false, messaggio: 'Nessun bambino attivo.' };

  const [{ data: costi }, { data: presenzeAssenza }, { data: giaInviate }, { data: template }, chiusure] =
    await Promise.all([
      supabase.from('costi_bambini').select('*').in('bambino_id', bambinoIds),
      supabase
        .from('presenze')
        .select('bambino_id')
        .in('bambino_id', bambinoIds)
        .gte('data', primoGiornoMese(mesePrecedenteValore))
        .lte('data', ultimoGiornoMese(mesePrecedenteValore))
        .in('stato', ['assente', 'malattia']),
      supabase.from('comunicazioni_retta').select('bambino_id').eq('mese', meseCorrente).in('bambino_id', bambinoIds),
      supabase.from('impostazioni_email_retta').select('oggetto, corpo').eq('id', true).maybeSingle(),
      chiusurePerPeriodo(supabase, primoGiornoMese(mesePrecedenteValore), ultimoGiornoMese(meseCorrente)),
    ]);

  const giorniApertura = giorniAperturaMese(meseCorrente, chiusure);

  const costiPerBambino = new Map((costi ?? []).map((c) => [c.bambino_id, c]));
  const assenzePerBambino = new Map<string, number>();
  for (const riga of presenzeAssenza ?? []) {
    assenzePerBambino.set(riga.bambino_id, (assenzePerBambino.get(riga.bambino_id) ?? 0) + 1);
  }
  const giaInviateSet = new Set((giaInviate ?? []).map((r) => r.bambino_id));

  const inviataDaNome = `${profilo?.nome ?? ''} ${profilo?.cognome ?? ''}`.trim() || user.email || 'Sconosciuto';

  let inviate = 0;
  let ignorate = 0;

  for (const bambino of bambini ?? []) {
    if (giaInviateSet.has(bambino.id)) continue;

    const costiBambino = costiPerBambino.get(bambino.id);
    if (!costiBambino?.email_promemoria) {
      ignorate++;
      continue;
    }

    const costiExtra = importoEuro(formData.get(`costi_extra_${bambino.id}`));
    const noteExtra = ((formData.get(`note_extra_${bambino.id}`) as string) || '').trim() || null;

    const riepilogo = calcolaRiepilogoRetta({
      prezzoMensile: Number(costiBambino.prezzo_mensile),
      prezzoBuonoPasto: Number(costiBambino.prezzo_buono_pasto),
      giorniAperturaMeseCorrente: giorniApertura,
      giorniAssenzaMesePrecedente: assenzePerBambino.get(bambino.id) ?? 0,
      marcaDaBollo: Number(costiBambino.prezzo_marca_da_bollo),
      preAsiloRichiesto: costiBambino.pre_asilo_richiesto,
      prezzoPreAsilo: Number(costiBambino.prezzo_pre_asilo),
      postAsiloRichiesto: costiBambino.post_asilo_richiesto,
      prezzoPostAsilo: Number(costiBambino.prezzo_post_asilo),
      costiExtra,
    });

    const valoriPlaceholder = {
      nome: bambino.nome,
      cognome: bambino.cognome,
      mese: formattaMeseItaliano(meseCorrente),
      retta_mensile: formattaImporto(riepilogo.rettaMensile),
      costo_pasti: formattaImporto(riepilogo.costoPasti),
      conguaglio_pasti: formattaImporto(riepilogo.conguaglioPasti),
      marca_da_bollo: formattaImporto(riepilogo.marcaDaBollo),
      costo_pre_asilo: formattaImporto(riepilogo.costoPreAsilo),
      costo_post_asilo: formattaImporto(riepilogo.costoPostAsilo),
      costi_extra: formattaImporto(riepilogo.costiExtra),
      totale: formattaImporto(riepilogo.totale),
    };

    const oggetto = sostituisciPlaceholder(template?.oggetto ?? 'Promemoria retta {{mese}}', valoriPlaceholder);
    const corpoHtml = sostituisciPlaceholder(template?.corpo ?? '', valoriPlaceholder).replace(/\n/g, '<br>');

    try {
      await inviaEmail({ a: costiBambino.email_promemoria, oggetto, html: corpoHtml });
    } catch (errore) {
      ignorate++;
      continue;
    }

    const { error: erroreLog } = await supabase.from('comunicazioni_retta').insert({
      bambino_id: bambino.id,
      mese: meseCorrente,
      retta_mensile: riepilogo.rettaMensile,
      costo_pasti: riepilogo.costoPasti,
      conguaglio_pasti: riepilogo.conguaglioPasti,
      marca_da_bollo: riepilogo.marcaDaBollo,
      costo_pre_asilo: riepilogo.costoPreAsilo,
      costo_post_asilo: riepilogo.costoPostAsilo,
      costi_extra: riepilogo.costiExtra,
      note_costi_extra: noteExtra,
      totale: riepilogo.totale,
      email_destinatario: costiBambino.email_promemoria,
      inviata_da: user.id,
      inviata_da_nome: inviataDaNome,
    });
    if (erroreLog) {
      ignorate++;
      continue;
    }

    inviate++;
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
