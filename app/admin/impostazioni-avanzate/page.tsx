import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { requireAdmin } from '@/lib/auth';
import { AZIONI_AVANZATE } from '@/lib/impostazioniAvanzate';

export const dynamic = 'force-dynamic';

// specs/57 - reset-giornata.md: pagina intermedia, riservata all'admin, che
// elenca le azioni di amministrazione avanzate (oggi solo il reset di una
// giornata). Per aggiungerne altre basta una voce in AZIONI_AVANZATE.
export default async function ImpostazioniAvanzatePage() {
  const { user, profilo } = await requireAdmin();

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-lg font-medium">Impostazioni avanzate</h1>
          <p className="mt-1 text-sm text-stone-600">
            Azioni di amministrazione avanzate, riservate all&apos;admin. Alcune sono irreversibili: usale con
            attenzione.
          </p>
        </div>

        <ul className="space-y-3">
          {AZIONI_AVANZATE.map((azione) => (
            <li key={azione.href}>
              <Link
                href={azione.href}
                className="flex min-h-11 items-start gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition-colors hover:bg-stone-50"
              >
                <span aria-hidden className="text-lg">
                  {azione.icona}
                </span>
                <span>
                  <span className="block text-sm font-medium text-stone-900">{azione.titolo}</span>
                  <span className="mt-0.5 block text-sm text-stone-600">{azione.descrizione}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </NavHeader>
  );
}
