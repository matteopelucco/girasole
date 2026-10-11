import { NavHeader } from '@/components/NavHeader';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// specs/62 - parametri-di-funzionamento.md: pagina riservata all'admin, sotto
// "Impostazioni". Per ora ha solo titolo e descrizione; le sezioni future vanno
// aggiunte sotto l'intestazione, una dopo l'altra, ciascuna con il proprio titolo.
export default async function ParametriFunzionamentoPage() {
  const { user, profilo } = await requireAdmin();

  return (
    <NavHeader nome={profilo?.nome || user.email || ''} ruolo={profilo?.ruolo ?? null}>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-lg font-medium">Parametri di funzionamento</h1>
          <p data-testid="descrizione-pagina" className="mt-1 text-sm text-stone-600">
            Le impostazioni che regolano il funzionamento dell&apos;app, visibili e modificabili solo
            dall&apos;admin.
          </p>
        </div>
      </main>
    </NavHeader>
  );
}
