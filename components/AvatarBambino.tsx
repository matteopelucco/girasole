import { stileSesso } from '@/lib/giornata';

// Avatar illustrato della card bambino (specs/10, issue #108): una
// bambina, un bambino o una sagoma neutra, in un cerchio con bordo
// bianco sullo sfondo del colore del sesso. SVG inline, nessuna
// dipendenza né immagine esterna. Non è una foto: è lo stesso per tutti
// i bambini dello stesso sesso. Bambina/bambino hanno role="img" con il
// nome accessibile "Bambina"/"Bambino" (il sesso non è affidato al solo
// colore); il neutro è decorativo.

const PELLE = '#fbd5b3';
const PELLE_OMBRA = '#f2c29b';
const CAPELLI = '#7c4a2d';

// Collo, viso, occhi, guance e sorriso: comuni a bambina e bambino.
function Viso() {
  return (
    <>
      <rect x="28" y="38" width="8" height="9" fill={PELLE_OMBRA} />
      <circle cx="32" cy="29" r="13" fill={PELLE} />
      <circle cx="27" cy="30" r="1.6" fill="#3b2416" />
      <circle cx="37" cy="30" r="1.6" fill="#3b2416" />
      <circle cx="24" cy="34" r="2.2" fill="#f9a8b4" opacity="0.7" />
      <circle cx="40" cy="34" r="2.2" fill="#f9a8b4" opacity="0.7" />
      <path d="M28.5 35 Q32 38.5 35.5 35" stroke="#9a3412" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </>
  );
}

function Bambina() {
  return (
    <>
      {/* Capelli lunghi, dietro al viso. */}
      <path d="M16 30 C16 13 48 13 48 30 L50 53 C44 57 20 57 14 53 Z" fill={CAPELLI} />
      <path d="M12 64 C12 50 22 45 32 45 C42 45 52 50 52 64 Z" fill="#c4a1e8" />
      <Viso />
      <path
        d="M19 27 C19 17 26 14 32 14 C39 14 45 18 45 27 C40 22 34 21 28 23 C25 24 22 26 19 27 Z"
        fill={CAPELLI}
      />
      {/* Cerchietto. */}
      <path d="M19.5 22 C23 14.5 41 14.5 44.5 22" stroke="#ec4899" strokeWidth="3" strokeLinecap="round" fill="none" />
    </>
  );
}

function Bambino() {
  return (
    <>
      <path d="M12 64 C12 50 22 45 32 45 C42 45 52 50 52 64 Z" fill="#3b82f6" />
      <circle cx="19" cy="30" r="2.5" fill={PELLE_OMBRA} />
      <circle cx="45" cy="30" r="2.5" fill={PELLE_OMBRA} />
      <Viso />
      {/* Capelli corti con ciuffo. */}
      <path
        d="M18.5 28 C17 17 24 12 32 12 C41 12 47 17 45.5 28 C43 23 40 21 36 21 C33 22 29 21 26 20 C23 22 20 24 18.5 28 Z"
        fill={CAPELLI}
      />
      <path d="M26 14 C29 9 36 9 39 13 C35 12 31 12 26 14 Z" fill={CAPELLI} />
    </>
  );
}

function Neutro() {
  return (
    <>
      <circle cx="32" cy="27" r="11" fill="#a8a29e" />
      <path d="M12 64 C12 49 22 43 32 43 C42 43 52 49 52 64 Z" fill="#a8a29e" />
    </>
  );
}

export function AvatarBambino({ sesso, className }: { sesso: string | null | undefined; className?: string }) {
  const stile = stileSesso(sesso);
  const accessibilita = stile.nomeAvatar
    ? { role: 'img', 'aria-label': stile.nomeAvatar }
    : { 'aria-hidden': true as const, focusable: 'false' as const };

  return (
    <span
      className={`inline-block shrink-0 overflow-hidden rounded-full border-2 border-white shadow-sm ${stile.sfondoAvatar} ${className ?? 'h-12 w-12'}`}
    >
      <svg viewBox="0 0 64 64" className="h-full w-full" {...accessibilita}>
        {stile.sesso === 'F' ? <Bambina /> : stile.sesso === 'M' ? <Bambino /> : <Neutro />}
      </svg>
    </span>
  );
}
