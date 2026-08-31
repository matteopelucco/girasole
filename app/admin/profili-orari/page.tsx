import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { FormConEsito } from '@/components/FormConEsito';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { CampiOreSettimana } from '@/components/CampiOreSettimana';
import { requireAdmin } from '@/lib/auth';
import { totaleOreSettimanali } from '@/lib/profiliOrari';
import { creaProfiloOrario } from './actions';

export const dynamic = 'force-dynamic';

export default async function ProfiliOrariPage() {
  const { supabase, user, profilo } = await requireAdmin();

  const { data: profiliOrari } = await supabase
    .from('profili_orari')
    .select('id, nome, ore_lunedi, ore_martedi, ore_mercoledi, ore_giovedi, ore_venerdi')
    .order('nome');

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-lg font-medium">Profili orari</h1>
          <p className="mt-1 text-sm text-stone-600">
            Orari tipo settimanali (ore previste lunedì-venerdì) da assegnare al personale
            abilitato al report ore, da <a href="/admin/maestre" className="underline">Utenti</a>.
            Sabato e domenica non sono previsti: l&apos;asilo è chiuso ogni weekend.
          </p>
        </div>

        <FormConEsito
          action={creaProfiloOrario}
          resetSuOk
          className="space-y-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
        >
          <input
            name="nome"
            required
            placeholder="Nome (es. 35 ore settimanali)"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
          />
          <CampiOreSettimana />
          <PulsanteInvio className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
            Crea profilo orario
          </PulsanteInvio>
        </FormConEsito>

        <ul className="space-y-2">
          {profiliOrari?.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/profili-orari/${p.id}`}
                className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-stone-50"
              >
                <span>
                  {p.nome} <span className="text-stone-600">— {totaleOreSettimanali(p)}h/settimana</span>
                </span>
                <span className="text-xs text-stone-500">Modifica</span>
              </Link>
            </li>
          ))}
          {!profiliOrari?.length && (
            <li className="text-sm text-stone-600">Nessun profilo orario ancora creato.</li>
          )}
        </ul>
      </main>
    </NavHeader>
  );
}
