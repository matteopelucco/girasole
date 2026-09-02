import Link from 'next/link';
import { NavHeader } from '@/components/NavHeader';
import { requireAdmin } from '@/lib/auth';
import { oggi, lunediSettimana } from '@/lib/date';

const ETICHETTE_RUOLO: Record<string, string> = {
  admin: 'Admin',
  maestra: 'Maestra',
  assistente: 'Assistente',
};

export const dynamic = 'force-dynamic';

// Elenco del personale abilitato al report ore, per l'admin (specs/18 -
// report-ore-lavoro.md, sezione "Amministrazione"): punto d'ingresso
// per rivedere/correggere le ore di chiunque, anche una settimana già
// confermata — la pagina vera e propria è la stessa vista personale di
// `/dashboard/ore-lavoro`, solo con `?utente=<id>` impostato (nessuna
// pagina duplicata, CLAUDE.md/jscpd).
export default async function OreLavoroAdminPage() {
  const { supabase, user, profilo } = await requireAdmin();

  const settimanaCorrenteInizio = lunediSettimana(oggi());

  const { data: profili } = await supabase
    .from('profili')
    .select('id, nome, cognome, email, ruolo')
    .eq('abilitato_ore_lavoro', true)
    .neq('id', user.id)
    .order('cognome');
  const personale = profili ?? [];

  const idPersonale = personale.map((p) => p.id);
  const { data: confermate } = idPersonale.length
    ? await supabase
        .from('ore_lavoro_settimane')
        .select('utente_id')
        .eq('settimana_inizio', settimanaCorrenteInizio)
        .in('utente_id', idPersonale)
    : { data: [] as { utente_id: string }[] };
  const idConfermati = new Set((confermate ?? []).map((c) => c.utente_id));

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <div>
          <a href="/dashboard" className="text-sm text-stone-600 hover:text-stone-900">
            ← Torna alla dashboard
          </a>
          <h1 className="mt-2 text-lg font-medium">Ore di lavoro — personale</h1>
          <p className="mt-1 text-sm text-stone-600">
            Rivedi e correggi le ore di chiunque sia abilitato al report ore, anche una
            settimana già confermata.
          </p>
        </div>

        <ul className="space-y-2">
          {personale.map((p) => (
            <li key={p.id} className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
              <Link href={`/dashboard/ore-lavoro?utente=${p.id}`} className="flex items-center justify-between gap-2">
                <span>
                  <span className="font-medium">
                    {p.nome} {p.cognome}
                  </span>{' '}
                  <span className="text-xs text-stone-600">
                    ({ETICHETTE_RUOLO[p.ruolo] ?? p.ruolo}) · {p.email}
                  </span>
                </span>
                <span className={`text-xs ${idConfermati.has(p.id) ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {idConfermati.has(p.id) ? 'Settimana corrente confermata' : 'Settimana corrente non confermata'}
                </span>
              </Link>
            </li>
          ))}
          {!personale.length && (
            <li className="text-sm text-stone-600">Nessun altro utente è abilitato al report ore.</li>
          )}
        </ul>
      </main>
    </NavHeader>
  );
}
