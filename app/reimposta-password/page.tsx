import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { REGOLA_PASSWORD } from '@/lib/password';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { impostaNuovaPassword } from './actions';

export const dynamic = 'force-dynamic';

const MESSAGGI_ERRORE: Record<string, string> = {
  mismatch: 'Le due password non coincidono.',
  debole: REGOLA_PASSWORD,
  generico: 'Non è stato possibile impostare la nuova password. Riprova.',
};

export default async function ReimpostaPasswordPage({
  searchParams,
}: {
  searchParams: { errore?: string; dettaglio?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?errore=link-non-valido');

  const messaggioErrore = searchParams?.errore ? MESSAGGI_ERRORE[searchParams.errore] : null;

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-medium">Imposta una nuova password</h1>
        <p className="mb-6 text-sm text-stone-600">{REGOLA_PASSWORD}</p>

        <form action={impostaNuovaPassword} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-stone-600" htmlFor="password">
              Nuova password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-stone-600" htmlFor="conferma">
              Conferma password
            </label>
            <input
              id="conferma"
              name="conferma"
              type="password"
              required
              minLength={8}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
          </div>

          {messaggioErrore && (
            <div role="alert">
              <p className="text-sm text-red-600">{messaggioErrore}</p>
              {searchParams?.dettaglio && (
                <p className="mt-1 text-xs text-red-500">{decodeURIComponent(searchParams.dettaglio)}</p>
              )}
            </div>
          )}

          <PulsanteInvio className="w-full rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-800">
            Salva nuova password
          </PulsanteInvio>
        </form>
      </div>
    </main>
  );
}
