// Limite ai tentativi di verifica della password per vedere i valori delle
// variabili d'ambiente (specs/62 - parametri-di-funzionamento.md, issue #287).
// Logica pura: lo stato per utente lo tiene chi chiama (la Server Action, in
// memoria), l'ora arriva come parametro.
//
// Regola: ogni tentativo conta come fallito finché non riesce; dopo
// MAX_TENTATIVI_FALLITI tentativi falliti di seguito l'utente è bloccato per
// DURATA_BLOCCO_MS; una verifica riuscita azzera tutto (chi chiama cancella lo
// stato). Allo scadere del blocco si riparte da zero.
//
// Limite noto: lo stato vive nella memoria del server. Su Vercel ogni istanza
// ha il suo e un riavvio lo azzera: è un freno contro i tentativi in serie,
// non una barriera assoluta. Resta comunque la protezione anti-brute-force di
// Supabase Auth sul login.

export const MAX_TENTATIVI_FALLITI = 5;
export const DURATA_BLOCCO_MS = 15 * 60_000;

export type StatoTentativi = { falliti: number; bloccatoFino: number | null };

function scaduto(stato: StatoTentativi, ora: number): boolean {
  return stato.bloccatoFino !== null && ora >= stato.bloccatoFino;
}

// Minuti (arrotondati per eccesso) che mancano alla fine del blocco; 0 se
// l'utente può riprovare.
export function minutiBloccoRimanenti(stato: StatoTentativi | undefined, ora: number): number {
  if (!stato || stato.bloccatoFino === null || scaduto(stato, ora)) return 0;
  return Math.ceil((stato.bloccatoFino - ora) / 60_000);
}

// Registra un tentativo (da chiamare PRIMA della verifica, così anche più
// richieste in parallelo vengono contate tutte).
export function registraTentativo(stato: StatoTentativi | undefined, ora: number): StatoTentativi {
  const base = !stato || scaduto(stato, ora) ? { falliti: 0, bloccatoFino: null } : stato;
  if (base.bloccatoFino !== null) return { ...base, falliti: base.falliti + 1 };
  const falliti = base.falliti + 1;
  return { falliti, bloccatoFino: falliti >= MAX_TENTATIVI_FALLITI ? ora + DURATA_BLOCCO_MS : null };
}

export function messaggioBlocco(minuti: number): string {
  return `Troppi tentativi. Riprova tra ${minuti} ${minuti === 1 ? 'minuto' : 'minuti'}.`;
}
