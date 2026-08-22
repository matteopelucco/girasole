import Link from 'next/link';
import Script from 'next/script';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { richiediResetPassword } from './actions';

export default function RecuperaPasswordPage({
  searchParams,
}: {
  searchParams: { inviato?: string };
}) {
  const inviato = searchParams?.inviato === '1';
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  return (
    <main className="flex flex-1 items-center justify-center px-4">
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

            {turnstileSiteKey && (
              <div className="cf-turnstile" data-sitekey={turnstileSiteKey} data-action="recupera-password" />
            )}

            <PulsanteInvio className="w-full rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-stone-700">
              Invia il link di recupero
            </PulsanteInvio>
          </form>
        )}

        {turnstileSiteKey && (
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
        )}

        <Link href="/login" className="mt-6 block text-center text-sm text-stone-500 underline">
          Torna al login
        </Link>
      </div>
    </main>
  );
}
