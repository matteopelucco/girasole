// Configurazione ESLint "flat" (Next 16, issue #306): `next lint` non
// esiste più e eslint-config-next@16 esporta solo il formato flat. Le
// regole sono le stesse del vecchio .eslintrc.json (next/core-web-vitals
// più i due confini client/server qui sotto).
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = defineConfig([
  ...nextVitals,
  globalIgnores([
    // Ignorati di default da eslint-config-next (ridichiarati perché
    // globalIgnores li sostituisce).
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Output generati da Playwright, non codice del repo.
    'playwright-report/**',
    'playwright-report-anteprima/**',
    'playwright-json/**',
    'test-results/**',
    'test-results-anteprima/**',
    'blob-report/**',
    'playwright/**',
  ]),
  {
    // eslint-plugin-react-hooks 7 (arrivato con eslint-config-next 16)
    // aggiunge regole nuove legate al React Compiler. Questa segnala due
    // effetti esistenti (BarraCaricamento, FormConEsito) che funzionano:
    // riscriverli non fa parte dell'aggiornamento di Next (#306), quindi
    // resta un avviso, non un errore.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    // Nei test Playwright `use` è la funzione delle fixture, non l'hook
    // React `use`: la regola degli hook qui dà solo falsi allarmi.
    files: ['e2e/**', 'e2e-anteprima/**'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  {
    // Confine client/server (A13, issue #17): lib/auth.ts fa query Supabase
    // lato server e usa redirect()/next/headers (tramite
    // lib/supabase/server.ts) — importarlo da un Client Component rompe
    // `next build` ("You're importing a component that needs
    // next/headers"), bug reale in v0.39.0/v0.40.0 (vedi CHANGELOG,
    // "Bugfix: due deploy Vercel di fila falliti"). `no-restricted-imports`
    // vede solo gli import scritti nel file lintato, non l'intero grafo:
    // qui copriamo l'import DIRETTO da un Client Component. Il caso
    // transitivo di allora (VerificaBonifico → comunicazioneRetta →
    // calendarioScolastico → auth) è coperto dal secondo blocco sotto,
    // che vieta a qualunque altro modulo lib/*.ts di importare auth.ts —
    // così un Client Component non può più raggiungerlo nemmeno di
    // riflesso, qualunque modulo lib/* attraversi.
    //
    // "files" individua i Client Component per posizione, non per
    // contenuto (no-restricted-imports non legge la direttiva 'use
    // client'): components/**/*.tsx è oggi l'unica cartella con
    // componenti client del repo (verificato per #17: nessuno dei file
    // che importano lib/auth vive lì); app/**/error.tsx e
    // app/**/global-error.tsx sono client per vincolo di Next.js. Se in
    // futuro un Client Component nascesse altrove (es. direttamente sotto
    // app/**), questo blocco non lo coprirebbe: vedi nota nella PR.
    files: ['components/**/*.tsx', 'app/**/error.tsx', 'app/**/global-error.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/lib/auth',
              message:
                'lib/auth.ts fa query Supabase lato server e usa redirect(): non importabile da un Client Component. Passa il dato (es. ruolo/profilo) come prop da un Server Component.',
            },
            {
              name: '@/lib/supabase/server',
              message:
                'lib/supabase/server.ts usa next/headers: importarlo da un Client Component rompe `next build` (bug storico v0.39.0/v0.40.0). Usa lib/supabase/client.ts oppure passa i dati come prop da un Server Component.',
            },
          ],
        },
      ],
    },
  },
  {
    // Stesso obiettivo del blocco sopra, versione "root cause": nessun
    // altro modulo lib/*.ts (a parte lib/auth.ts stesso) può importare
    // lib/auth o lib/supabase/server. Così un modulo lib/* che oggi è
    // "sicuro per il client" (es. lib/calendarioScolastico.ts,
    // lib/comunicazioneRetta.ts) non può acquisire quella dipendenza in
    // futuro senza far fallire subito il lint, invece di scoprirlo solo a
    // `next build` — indipendentemente da quali Client Component lo
    // importino oggi o domani. lib/auth.test.ts è escluso insieme a tutti
    // i *.test.ts: girano solo sotto Vitest (Node), mai nel bundle
    // browser.
    files: ['lib/**/*.ts'],
    ignores: ['lib/auth.ts', 'lib/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/lib/auth',
              message:
                'Solo lib/auth.ts stesso può importare sé stesso; nessun altro modulo lib/* deve dipendere da lib/auth.ts, altrimenti rischia di trascinare next/headers in un Client Component che lo importa transitivamente.',
            },
            {
              name: '@/lib/supabase/server',
              message:
                'lib/supabase/server.ts usa next/headers ed è pensato per essere importato solo da lib/auth.ts: nessun altro modulo lib/* deve importarlo direttamente.',
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
