import { cva, type VariantProps } from 'class-variance-authority';

// Aspetto dei pulsanti di stato della scheda bambino (issue #350, specs/10,
// 13 e 14, specs/01 - ux.md): Presente / Assente / Malattia, Pre-asilo /
// Post-asilo, Sì / No. Pillola a tutta larghezza della cella, alta almeno
// 44 px su ogni schermo (a differenza di `Pulsante misura="normale"`, che sopra
// i 640 px torna all'altezza naturale: qui i test e2e controllano i 44 px
// anche su desktop). Si usa con `Pulsante`/`PulsanteInvio` senza `variante` né
// `misura`: da lì arrivano solo anello di focus e stato disabilitato.
//
// - `tono="spento"`: non selezionato, bordo e sfondo bianco.
// - `successo` (verde: Presente, Sì), `neutro` (grigio: Assente), `info`
//   (azzurro: Pre/Post-asilo): token di significato, stessi colori di prima.
// - `negativo` (rosso: Malattia, No): resta `rose-600`, che non è un token
//   (`danger` è red-700, un altro rosso), per non cambiare il colore.
//
// Stringhe letterali (non composte a runtime): Tailwind genera il CSS
// leggendo il testo sorgente. Niente 'use client'.
const pulsanteStatoVariants = cva(
  'inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm',
  {
    variants: {
      tono: {
        spento: 'border border-input bg-background font-medium text-stone-700 hover:border-stone-500',
        successo: 'bg-success font-semibold text-primary-foreground shadow-xs',
        neutro: 'bg-neutral font-semibold text-primary-foreground shadow-xs',
        negativo: 'bg-rose-600 font-semibold text-primary-foreground shadow-xs',
        info: 'bg-info font-semibold text-primary-foreground shadow-xs',
      },
    },
    defaultVariants: { tono: 'spento' },
  },
);

type PulsanteStatoVariants = VariantProps<typeof pulsanteStatoVariants>;

export { pulsanteStatoVariants };
export type { PulsanteStatoVariants };
