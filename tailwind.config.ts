import type { Config } from 'tailwindcss';

const config: Config = {
  // lib/**: alcuni moduli (es. lib/classiStato.ts) contengono classi
  // Tailwind letterali usate solo lì — un bug reale (pulsante "Assente"
  // invisibile: bg-stone-600 non veniva mai generato) è nato da questo
  // path mancante, perché Tailwind include nel CSS finale solo le
  // classi che trova come testo nei file scansionati.
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
export default config;
