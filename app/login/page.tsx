import Image from 'next/image';
import { login } from './actions';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { errore?: string };
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

          {searchParams?.errore && (
            <p className="text-sm text-red-600">Credenziali non valide. Riprova.</p>
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
