import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { REGOLA_PASSWORD } from '@/lib/password';
import { Campo } from '@/components/ui/campo';
import { Etichetta } from '@/components/ui/etichetta';
import { Avviso } from '@/components/ui/avviso';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { impostaNuovaPassword } from './actions';

export const dynamic = 'force-dynamic';

const MESSAGGI_ERRORE: Record<string, string> = {
  mismatch: 'Le due password non coincidono.',
  debole: REGOLA_PASSWORD,
  generico: 'Non è stato possibile impostare la nuova password. Riprova.',
};

export default async function ReimpostaPasswordPage(
  props: {
    searchParams: Promise<{ errore?: string; dettaglio?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login?errore=link-non-valido');

  const messaggioErrore = searchParams?.errore ? MESSAGGI_ERRORE[searchParams.errore] : null;

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-white p-8 shadow-xs">
        <h1 className="mb-1 text-xl font-medium">Imposta una nuova password</h1>
        <p className="mb-6 text-sm text-stone-600">{REGOLA_PASSWORD}</p>

        <form action={impostaNuovaPassword} className="space-y-4">
          <div>
            <Etichetta htmlFor="password" className="mb-1">
              Nuova password
            </Etichetta>
            <Campo
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              className="w-full"
            />
          </div>
          <div>
            <Etichetta htmlFor="conferma" className="mb-1">
              Conferma password
            </Etichetta>
            <Campo
              id="conferma"
              name="conferma"
              type="password"
              required
              minLength={8}
              className="w-full"
            />
          </div>

          {messaggioErrore && (
            <Avviso tono="errore">
              <p>{messaggioErrore}</p>
              {searchParams?.dettaglio && (
                <p className="mt-1 text-xs">{decodeURIComponent(searchParams.dettaglio)}</p>
              )}
            </Avviso>
          )}

          <PulsanteInvio variante="primario" misura="normale" className="w-full">
            Salva nuova password
          </PulsanteInvio>
        </form>
      </div>
    </main>
  );
}
