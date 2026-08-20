import Image from 'next/image';
import Link from 'next/link';
import { login } from './actions';

const MESSAGGI_ERRORE: Record<string, string> = {
  credenziali: 'Credenziali non valide. Riprova.',
  'link-non-valido': 'Il link non è più valido o è scaduto. Richiedine uno nuovo.',
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { errore?: string; reset?: string; email?: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
        <Image
          src="/girasole.png"
          alt="Girasole"
          width={96}
          height={96}
          className="mx-auto mb-4"
          priority
        />
        <h1 className="mb-1 text-center text-xl font-medium">Girasole</h1>
        <p className="mb-6 text-center text-sm text-stone-500">
          Registro elettronico — Asilo Sartorio
        </p>

        <form action={login} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-stone-600" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              defaultValue={searchParams?.email ?? ''}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-stone-600" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
            />
          </div>

          {searchParams?.reset === 'ok' && (
            <p className="text-sm text-green-700">
              Password aggiornata. Accedi con la nuova password.
            </p>
          )}

          {searchParams?.errore && (
            <div className="space-y-1">
              <p className="text-sm text-red-600">
                {MESSAGGI_ERRORE[searchParams.errore] ?? MESSAGGI_ERRORE.credenziali}
              </p>
              <Link href="/recupera-password" className="text-sm text-stone-500 underline">
                Non ricordi la password?
              </Link>
            </div>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
          >
            Accedi
          </button>
        </form>
      </div>
    </main>
  );
}
