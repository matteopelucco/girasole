import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { requireAdmin } from '@/lib/auth';
import { SOTTOSEZIONI_IMPOSTAZIONI } from '@/lib/impostazioniAvanzate';

export const dynamic = 'force-dynamic';

// specs/57 - reset-giornata.md: pagina indice, riservata all'admin, con un
// riquadro per ogni sottosezione di "Impostazioni". Per aggiungerne altre
// basta una voce in SOTTOSEZIONI_IMPOSTAZIONI (che alimenta anche il menu).
export default async function ImpostazioniAvanzatePage() {
  const { user, profilo } = await requireAdmin();

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-lg font-medium">Impostazioni</h1>
          <p className="mt-1 text-sm text-stone-600">
            Strumenti di amministrazione avanzati, riservati all&apos;admin. Alcuni sono irreversibili: usali con
            attenzione.
          </p>
        </div>

        <ul className="space-y-3">
          {SOTTOSEZIONI_IMPOSTAZIONI.map((sezione) => (
            <li key={sezione.href}>
              <Link
                href={sezione.href}
                className="flex min-h-11 items-start gap-3 rounded-xl border border-border bg-white p-4 shadow-xs transition-colors hover:bg-stone-50"
              >
                <span aria-hidden className="text-lg">
                  {sezione.icona}
                </span>
                <span>
                  <span className="block text-sm font-medium text-stone-900">{sezione.titolo}</span>
                  <span className="mt-0.5 block text-sm text-stone-600">{sezione.descrizione}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </NavHeader>
  );
}
