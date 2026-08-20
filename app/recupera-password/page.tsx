import Link from 'next/link';
import { richiediResetPassword } from './actions';

export default function RecuperaPasswordPage({
  searchParams,
}: {
  searchParams: { inviato?: string };
}) {
  const inviato = searchParams?.inviato === '1';

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-medium">Recupera password</h1>
        <p className="mb-6 text-sm text-stone-500">
          Inserisci l&apos;email con cui accedi: se l&apos;account esiste, riceverai un link per
          reimpostare la password.
        </p>

        {inviato ? (
          <p className="rounded-lg bg-stone-100 p-3 text-sm text-stone-700">
            Se l&apos;indirizzo esiste, riceverai a breve un&apos;email con le istruzioni per
            reimpostare la password. Il link è valido un&apos;ora.
          </p>
        ) : (
          <form action={richiediResetPassword} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-stone-600" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
            >
              Invia il link di recupero
            </button>
          </form>
        )}

        <Link href="/login" className="mt-6 block text-center text-sm text-stone-500 underline">
          Torna al login
        </Link>
      </div>
    </main>
  );
}
