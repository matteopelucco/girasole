import Link from 'next/link';
import { caricaAllarmiCorrenti } from '@/app/dashboard/allarmi/dati';
import { testoNumeroAllarmi } from '@/lib/elencoAllarmi';

const CLASSI_LINK = 'relative rounded-lg p-2 text-stone-600 hover:bg-stone-100 hover:text-stone-900';

function IconaCampanella() {
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
      className="h-5 w-5"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

// Campanella in alto a destra (specs/07 - allarmi.md): porta alla pagina
// "Allarmi". Con almeno un allarme mostra un pallino col numero, letto
// dallo screen reader come "3 allarmi"; a zero allarmi nessun numero.
// Componente server, usato dentro un Suspense da components/NavHeader.tsx.
export async function CampanellaAllarmi() {
  const allarmi = await caricaAllarmiCorrenti();
  if (allarmi === null) return null;

  const numero = allarmi.length;
  return (
    <Link href="/dashboard/allarmi" aria-label={numero > 0 ? testoNumeroAllarmi(numero) : 'Allarmi'} className={CLASSI_LINK}>
      <IconaCampanella />
      {numero > 0 && (
        <span
          aria-hidden="true"
          data-testid="numero-allarmi"
          className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white"
        >
          {numero}
        </span>
      )}
    </Link>
  );
}

// Segnaposto mentre il numero si sta calcolando: la campanella c'è già
// (cliccabile), senza pallino.
export function CampanellaAllarmiCaricamento() {
  return (
    <Link href="/dashboard/allarmi" aria-label="Allarmi" className={CLASSI_LINK}>
      <IconaCampanella />
    </Link>
  );
}
