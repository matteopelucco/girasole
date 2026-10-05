import type { SupabaseClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { InvioEmailRojac } from '@/components/InvioEmailRojac';
import { destinatarioNotifiche, destinatarioRojac } from '@/lib/email';
import { componiEmailRojac, PASTI_INSEGNANTI_AL_GIORNO } from '@/lib/emailRojac';
import { caricaDatiEmailRojac } from '@/lib/emailRojacDati';
import { inviaEmailRojac } from './actions';

// Riquadro "Mail mensile a Rojac" del Report mensile, solo admin
// (specs/61 - email-pasti-rojac.md): i numeri del mese (pasti bambini,
// pasti insegnanti, totale), l'invio con anteprima e il link al modello.
// La pagina lo renderizza solo per l'admin, in vista mensile, per il mese
// corrente o passato.
export async function BoxEmailRojac({ supabase, mese }: { supabase: SupabaseClient; mese: string }) {
  const { riepilogo, template } = await caricaDatiEmailRojac(supabase, mese);
  const destinatario = destinatarioRojac();
  const { oggetto, testo } = componiEmailRojac(template, riepilogo);

  return (
    <section aria-labelledby="titolo-email-rojac" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <h2 id="titolo-email-rojac" className="text-sm font-semibold text-emerald-900">
        Mail mensile a Rojac
      </h2>
      <dl className="mt-2 space-y-0.5 text-sm text-emerald-900">
        <div className="flex gap-2">
          <dt>Pasti bambini:</dt>
          <dd className="font-medium">{riepilogo.pastiBambini}</dd>
        </div>
        <div className="flex gap-2">
          <dt>
            Pasti insegnanti ({riepilogo.giorniScuola} giorni di scuola × {PASTI_INSEGNANTI_AL_GIORNO}):
          </dt>
          <dd className="font-medium">{riepilogo.pastiInsegnanti}</dd>
        </div>
        <div className="flex gap-2">
          <dt>Totale pasti:</dt>
          <dd className="font-semibold">{riepilogo.totalePasti}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {destinatario ? (
          <InvioEmailRojac
            mese={mese}
            a={destinatario}
            cc={destinatarioNotifiche()}
            oggetto={oggetto}
            corpo={testo}
            azione={inviaEmailRojac}
          />
        ) : (
          <p className="text-sm text-amber-900">
            L&apos;indirizzo email di Rojac non è configurato (variabile ROJAC_EMAIL_DESTINATARIO): non è possibile
            inviare la mail.
          </p>
        )}
        <Link href="/admin/rojac/template" className="text-sm text-emerald-900 underline hover:text-emerald-950">
          Modello email Rojac
        </Link>
      </div>
    </section>
  );
}
