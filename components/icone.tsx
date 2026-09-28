import type { ReactNode } from 'react';

// Icone (SVG inline, nessuna dipendenza) della card bambino della
// schermata "Presenze e pasti" (specs/10): piene per i titoli delle
// sezioni, lineare per "Salva nota". Sempre decorative (aria-hidden): il
// significato è dato dal testo accanto — "Presenza", "Pasto", "Nota",
// "Salva nota" — mai dalla sola icona
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

// Icone piene dei titoli delle sezioni della card (issue #110).
function SvgPiena({ className, children }: PropsIcona & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className={className ?? 'h-4 w-4'}>
      {children}
    </svg>
  );
}

export function IconaPersona({ className }: PropsIcona) {
  return (
    <SvgPiena className={className}>
      <circle cx="12" cy="7" r="4.5" />
      <path d="M3.5 21.5a8.5 8 0 0 1 17 0z" />
    </SvgPiena>
  );
}

export function IconaPosate({ className }: PropsIcona) {
  return (
    <SvgPiena className={className}>
      <path d="M4 2h1.6v6.5h1.2V2h1.6v6.5h1.2V2h1.6v7.5a3.2 3.2 0 0 1-2.4 3.1V22H6.4v-9.4A3.2 3.2 0 0 1 4 9.5z" />
      <path d="M18.5 2.2V22h-2.8v-7.5c-1.4-.5-2.2-2-2.2-4.2 0-4 1.8-7.1 4.2-8.3a.6.6 0 0 1 .8.2z" />
    </SvgPiena>
  );
}

export function IconaNota({ className }: PropsIcona) {
  return (
    <SvgPiena className={className}>
      <path
        fillRule="evenodd"
        d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm2 5.2v1.6h8V7.2zm0 4v1.6h8v-1.6zm0 4v1.6h5v-1.6z"
      />
    </SvgPiena>
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
