import type { Config } from 'tailwindcss';

const config: Config = {
  // lib/**: alcuni moduli (es. lib/classiStato.ts) contengono classi
  // Tailwind letterali usate solo lì — un bug reale (pulsante "Assente"
  // invisibile: bg-stone-600 non veniva mai generato) è nato da questo
  // path mancante, perché Tailwind include nel CSS finale solo le
  // classi che trova come testo nei file scansionati.
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Coppia di font ispirata al riferimento grafico indicato
      // dall'utente (Falcon): titoli in Poppins (più rotondo/friendly,
      // adatto a un asilo), testo in Open Sans. Caricati come variabili
      // CSS da next/font/google in app/layout.tsx — nessuna dipendenza
      // nuova, next/font è già incluso in Next.js.
      fontFamily: {
        sans: ['var(--font-open-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['var(--font-poppins)', 'var(--font-open-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
