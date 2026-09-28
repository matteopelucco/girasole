import type { ReactNode } from 'react';

// Icone lineari (SVG inline, nessuna dipendenza) della card bambino della
// schermata "Presenze e pasti" (specs/10). Sempre decorative
// (aria-hidden): il significato è dato dal testo accanto — "Femmina",
// "Maschio", "Presenza", "Pasto", "Salva nota" — mai dalla sola icona
// (specs/01, accessibilità).
type PropsIcona = { className?: string };

function Svg({ className, children }: PropsIcona & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className ?? 'h-4 w-4'}
    >
      {children}
    </svg>
  );
}

// ♀: cerchio con la croce in basso.
export function IconaFemmina({ className }: PropsIcona) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="9" r="5" />
      <path d="M12 14v7M9 18h6" />
    </Svg>
  );
}

// ♂: cerchio con la freccia verso l'alto a destra.
export function IconaMaschio({ className }: PropsIcona) {
  return (
    <Svg className={className}>
      <circle cx="10" cy="14" r="5" />
      <path d="M14 10l6-6M15 4h5v5" />
    </Svg>
  );
}

export function IconaPersona({ className }: PropsIcona) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </Svg>
  );
}

export function IconaPosate({ className }: PropsIcona) {
  return (
    <Svg className={className}>
      <path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 21V3c-2 1-3 4-3 7s1 4 3 4" />
    </Svg>
  );
}

export function IconaNota({ className }: PropsIcona) {
  return (
    <Svg className={className}>
      <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </Svg>
  );
}

export function IconaSalva({ className }: PropsIcona) {
  return (
    <Svg className={className}>
      <path d="M5 3h11l3 3v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M8 3v5h7V3M8 21v-7h8v7" />
    </Svg>
  );
}
