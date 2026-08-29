import { NavHeader } from '@/components/NavHeader';
import { requireStaff, assicuraAccessoOreLavoro } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Punto d'ingresso della sezione "Ore di lavoro" (specs/17 -
// ore-di-lavoro.md): in questa fase abilita solo l'accesso, senza alcuna
// form — la registrazione vera e propria di ore/assenze è fuori scope,
// verrà definita in una fase successiva.
export default async function OreLavoroPage() {
  const { user, profilo, ruolo } = await requireStaff({});
  assicuraAccessoOreLavoro(profilo?.abilitato_ore_lavoro);

  const nomeVisualizzato = profilo?.nome || user.email || '';

  return (
    <>
      <NavHeader nome={nomeVisualizzato} ruolo={ruolo} />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <a href="/dashboard" className="text-sm text-stone-600 hover:text-stone-900">
          ← Torna alla dashboard
        </a>
        <h1 className="mt-2 text-lg font-medium">Ore di lavoro</h1>
        <div className="mt-6 rounded-xl border border-dashed border-stone-300 p-6 text-sm text-stone-600">
          La registrazione delle ore di lavoro effettuate (o delle assenze) sarà disponibile in
          una fase successiva. Per ora questa sezione conferma solo che sei abilitata a usarla —
          chiedi all&rsquo;admin se pensavi di esserlo e non la vedi.
        </div>
      </main>
    </>
  );
}
