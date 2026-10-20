import { NavHeader } from '@/components/NavHeader';
import { VariabiliAmbiente } from '@/components/VariabiliAmbiente';
import { ParametriFunzionalita } from '@/components/ParametriFunzionalita';
import { requireAdmin } from '@/lib/auth';
import { nomiParametriPresenti } from '@/lib/parametriAmbiente';
import { PARAMETRI_VISIBILI } from '@/lib/parametriVisibili';
import { SezioneCalendarioGoogle } from '@/components/SezioneCalendarioGoogle';
import { statoCalendario } from '@/lib/calendarioImpostazioniDati';
import { aggiornaIndirizzoCalendario, rivelaIndirizzoCalendario, rivelaValoriParametri } from './actions';

// force-dynamic: la pagina è resa a ogni richiesta (legge l'ambiente del
// server) e la risposta ha `Cache-Control: no-store`.
export const dynamic = 'force-dynamic';

// specs/62 - parametri-di-funzionamento.md: pagina riservata all'admin, sotto
// "Impostazioni". Le sezioni stanno sotto l'intestazione, una dopo l'altra,
// ciascuna con il proprio titolo.
export default async function ParametriFunzionamentoPage() {
  const { supabase, user, profilo } = await requireAdmin();
  // Solo i NOMI arrivano al browser: i valori restano sul server finché
  // l'admin non reinserisce la password (actions.ts).
  const nomi = nomiParametriPresenti(PARAMETRI_VISIBILI, process.env);
  // Del calendario arriva al browser solo se l'indirizzo c'è, mai il valore.
  const calendario = await statoCalendario(supabase);

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

        <section aria-labelledby="titolo-variabili-ambiente" className="space-y-3">
          <div>
            <h2 id="titolo-variabili-ambiente" className="text-base font-medium">
              Variabili d&apos;ambiente
            </h2>
            <p data-testid="descrizione-variabili-ambiente" className="mt-1 text-sm text-stone-600">
              Le impostazioni dell&apos;ambiente in cui gira l&apos;app, in sola lettura. Per sicurezza i
              valori sono nascosti: per vederli reinserisci la tua password.
            </p>
          </div>
          {nomi.length === 0 ? (
            <p data-testid="nessuna-variabile" className="rounded-xl border border-border bg-white p-4 text-sm text-stone-600">
              Nessuna variabile d&apos;ambiente da mostrare.
            </p>
          ) : (
            <VariabiliAmbiente nomi={nomi} rivela={rivelaValoriParametri} />
          )}
        </section>
        <SezioneCalendarioGoogle stato={calendario} salva={aggiornaIndirizzoCalendario} rivela={rivelaIndirizzoCalendario} />
        <ParametriFunzionalita />
      </main>
    </NavHeader>
  );
}
