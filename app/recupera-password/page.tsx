import Link from 'next/link';
import Script from 'next/script';
import { Campo } from '@/components/ui/campo';
import { Etichetta } from '@/components/ui/etichetta';
import { Avviso } from '@/components/ui/avviso';
import { PulsanteInvio } from '@/components/PulsanteInvio';
import { richiediResetPassword } from './actions';

export default async function RecuperaPasswordPage(
  props: {
    searchParams: Promise<{ inviato?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const inviato = searchParams?.inviato === '1';
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-white p-8 shadow-xs">
        <h1 className="mb-1 text-xl font-medium">Recupera password</h1>
        <p className="mb-6 text-sm text-stone-600">
          Inserisci l&apos;email con cui accedi: se l&apos;account esiste, riceverai un link per
          reimpostare la password.
        </p>

        {inviato ? (
          <Avviso tono="informazione">
            Se l&apos;indirizzo esiste, riceverai a breve un&apos;email con le istruzioni per
            reimpostare la password. Il link è valido un&apos;ora.
          </Avviso>
        ) : (
          <form action={richiediResetPassword} className="space-y-4">
            <div>
              <Etichetta htmlFor="email" className="mb-1">
                Email
              </Etichetta>
              <Campo
                id="email"
                name="email"
                type="email"
                required
                className="w-full"
              />
            </div>

            {turnstileSiteKey && (
              <div className="cf-turnstile" data-sitekey={turnstileSiteKey} data-action="recupera-password" />
            )}

            <PulsanteInvio variante="primario" misura="normale" className="w-full">
              Invia il link di recupero
            </PulsanteInvio>
          </form>
        )}

        {turnstileSiteKey && (
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
        )}

        <Link href="/login" className="mt-6 block text-center text-sm text-stone-600 underline">
          Torna al login
        </Link>
      </div>
    </main>
  );
}
