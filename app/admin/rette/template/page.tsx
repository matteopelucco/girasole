import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { requireAdmin } from '@/lib/auth';
import { aggiornaTemplateEmailRetta } from './actions';

export const dynamic = 'force-dynamic';

const PLACEHOLDER_DISPONIBILI = [
  '{{nome}}',
  '{{cognome}}',
  '{{mese}}',
  '{{retta_mensile}}',
  '{{costo_pasti}}',
  '{{conguaglio_pasti}}',
  '{{costo_pre_asilo}}',
  '{{costo_post_asilo}}',
  '{{costi_extra}}',
  '{{totale}}',
];

export default async function TemplateEmailRettaPage() {
  const { supabase, user, profilo } = await requireAdmin();

  const { data: template } = await supabase
    .from('impostazioni_email_retta')
    .select('oggetto, corpo')
    .eq('id', true)
    .maybeSingle();

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <Link href="/admin/rette" className="text-sm text-stone-600 hover:text-stone-900">
          ← Torna a Rette
        </Link>

        <div>
          <h1 className="text-lg font-medium">Modello email retta</h1>
          <p className="mt-1 text-sm text-stone-600">
            Placeholder disponibili (sostituiti con i dati del bambino e del mese al momento dell&apos;invio,
            importi già formattati in euro):
          </p>
          <p className="mt-1 font-mono text-xs text-stone-600">{PLACEHOLDER_DISPONIBILI.join('  ')}</p>
        </div>

        <FormConEsito
          action={aggiornaTemplateEmailRetta}
          className="space-y-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
        >
          <label className="block text-xs text-stone-600">
            Oggetto
            <input
              name="oggetto"
              required
              defaultValue={template?.oggetto ?? ''}
              aria-label="Oggetto"
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
          </label>
          <label className="block text-xs text-stone-600">
            Corpo
            <textarea
              name="corpo"
              required
              rows={14}
              defaultValue={template?.corpo ?? ''}
              aria-label="Corpo"
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
          </label>
          <PulsanteInvio className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
            Salva modello
          </PulsanteInvio>
        </FormConEsito>
      </main>
    </NavHeader>
  );
}
