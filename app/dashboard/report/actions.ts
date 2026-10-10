'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { meseDaData, oggi } from '@/lib/date';
import { destinatarioNotifiche, destinatarioRojac, inviaEmail } from '@/lib/email';
import { componiEmailRojac, esitoDopoInvioRojac, meseInviabileRojac } from '@/lib/emailRojac';
import { caricaDatiEmailRojac } from '@/lib/emailRojacDati';
import type { EsitoAzione } from '@/components/FormConEsito';

// specs/61 - email-pasti-rojac.md, scenari "confermare l'invio manda la
// mail a Rojac con l'asilo in copia" e "errore nell'invio". Solo admin
// (requireAdmin reindirizza gli altri). I numeri sono sempre ricalcolati
// qui dal database, mai presi dal form: il client manda solo il mese.
// L'invio è una sola mail, a Rojac con l'indirizzo dell'asilo in CC.
// Solo dopo che la mail è partita si scrive il registro degli invii
// (`invii_rojac`): un invio fallito non registra nulla.
export async function inviaEmailRojac(_stato: EsitoAzione, formData: FormData): Promise<EsitoAzione> {
  const { supabase, user } = await requireAdmin();
  const mese = ((formData.get('mese') as string) || '').trim();

  if (!meseInviabileRojac(mese, meseDaData(oggi()))) {
    return { ok: false, messaggio: 'Il mese scelto non è valido o è nel futuro: nessuna mail inviata.' };
  }

  const destinatario = destinatarioRojac();
  if (!destinatario) {
    return { ok: false, messaggio: "L'indirizzo email di Rojac non è configurato: nessuna mail inviata." };
  }

  try {
    const { riepilogo, template } = await caricaDatiEmailRojac(supabase, mese);
    const { oggetto, html } = componiEmailRojac(template, riepilogo);
    // Reply-To all'asilo: le risposte di Rojac non tornano al mittente
    // tecnico (specs/61, issue #263).
    await inviaEmail({
      a: destinatario,
      cc: destinatarioNotifiche(),
      rispondiA: destinatarioNotifiche(),
      oggetto,
      html,
    });
  } catch (errore) {
    return {
      ok: false,
      messaggio: "Impossibile inviare la mail a Rojac. Riprova: se l'errore continua, avvisa chi gestisce l'app.",
      dettaglio: errore instanceof Error ? errore.message : String(errore),
    };
  }

  // La mail è partita: da qui in poi non si torna indietro. Se il registro
  // non si scrive l'azione resta "ok" (non va rimandata), con un avviso:
  // senza riga il mese potrebbe risultare non inviato (specs/61).
  const { error: erroreRegistro } = await supabase
    .from('invii_rojac')
    .insert({ mese, inviato_da: user.id });

  revalidatePath('/dashboard/report');
  return esitoDopoInvioRojac(!erroreRegistro);
}
