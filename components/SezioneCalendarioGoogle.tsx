import { FormConEsito, type EsitoAzione } from './FormConEsito';
import { IndirizzoCalendarioNascosto } from './IndirizzoCalendarioNascosto';
import { PulsanteInvio } from './PulsanteInvio';
import { formattaDataOraItaliana } from '@/lib/date';
import type { StatoCalendario } from '@/lib/calendarioImpostazioniDati';

// Sezione "Calendario Google" di "Parametri di funzionamento" (specs/64 -
// calendario-eventi.md): l'indirizzo iCal segreto del calendario dell'asilo.
// Dal server arriva al browser solo `configurato` (sì/no) e la data
// dell'ultimo salvataggio: l'indirizzo vero si vede solo dopo la verifica della
// password (IndirizzoCalendarioNascosto). Il campo di inserimento si svuota
// dopo ogni salvataggio riuscito: tutta la scheda ha come `key` la data di salvataggio, quindi a ogni salvataggio viene ricreata da capo: l'indirizzo non
// resta mai nella pagina.
export function SezioneCalendarioGoogle({
  stato,
  salva,
  rivela,
}: {
  // null = impostazione non leggibile.
  stato: StatoCalendario | null;
  salva: (statoPrecedente: EsitoAzione, formData: FormData) => Promise<EsitoAzione>;
  rivela: (formData: FormData) => Promise<{ ok: true; indirizzo: string } | { ok: false; messaggio: string }>;
}) {
  return (
    <section aria-labelledby="titolo-calendario-google" className="space-y-3">
      <div>
        <h2 id="titolo-calendario-google" className="text-base font-medium">
          Calendario Google
        </h2>
        <p data-testid="descrizione-calendario" className="mt-1 text-sm text-stone-600">
          L&apos;indirizzo iCal segreto del Google Calendar dell&apos;asilo: ogni notte Girasole ne legge gli
          eventi. Chi ha l&apos;indirizzo può leggere il calendario, per questo resta nascosto finché non
          reinserisci la tua password. Per disattivare la sincronizzazione svuota il campo e salva.
        </p>
      </div>

      {stato === null ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Impossibile leggere l&apos;impostazione del calendario. Riprova più tardi.
        </p>
      ) : (
        <div key={stato.aggiornatoIl} className="space-y-4 rounded-xl border border-stone-200 bg-white p-4 shadow-xs">
          <p data-testid="stato-calendario" className="text-sm font-medium">
            {stato.configurato ? 'Sincronizzazione attiva' : 'Sincronizzazione disattivata'}
          </p>

          {stato.configurato && <IndirizzoCalendarioNascosto rivela={rivela} />}

          <FormConEsito action={salva} className="space-y-2">
            <label htmlFor="indirizzo-ical" className="block text-sm font-medium text-stone-700">
              Indirizzo iCal del calendario
            </label>
            <p id="aiuto-indirizzo-ical" className="text-xs text-stone-600">
              In Google Calendar: Impostazioni, il calendario dell&apos;asilo, &quot;Integra il calendario&quot;,
              &quot;Indirizzo segreto in formato iCal&quot; (finisce con .ics). Non condividerlo.
            </p>
            <input
              id="indirizzo-ical"
              name="indirizzo"
              type="text"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-describedby="aiuto-indirizzo-ical"
              placeholder={stato.configurato ? 'Nuovo indirizzo (vuoto = disattiva)' : 'https://calendar.google.com/…/basic.ics'}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-hidden focus:border-stone-500"
            />
            <PulsanteInvio className="min-h-11 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
              Salva indirizzo
            </PulsanteInvio>
            {stato.configurato && stato.aggiornatoIl && (
              <p data-testid="ultimo-salvataggio-calendario" className="text-xs text-stone-500">
                Ultimo salvataggio: {formattaDataOraItaliana(stato.aggiornatoIl).replace('_', ' alle ')}
              </p>
            )}
          </FormConEsito>
        </div>
      )}
    </section>
  );
}
