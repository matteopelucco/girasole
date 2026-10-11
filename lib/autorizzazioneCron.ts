import { createHash, timingSafeEqual } from 'node:crypto';

// Autorizzazione delle route di cron (specs/07 - allarmi.md, specs/52 -
// report-email-automatico.md; issue #300). Logica pura, senza leggere
// process.env: il wrapper `autorizzaCron` in lib/auth.ts le passa i valori.

// Variabili di sistema di Vercel rilevanti: VERCEL_ENV
// ('production' | 'preview' | 'development') e VERCEL ('1' su Vercel).
export type AmbienteCron = { vercelEnv?: string; vercel?: string };

// Vero se in questo ambiente CRON_SECRET è obbligatorio.
//
// Si usa VERCEL_ENV e NON NODE_ENV: la CI e2e serve l'app con
// `next build` + `next start`, cioè con NODE_ENV=production, ma non è la
// produzione e non ha CRON_SECRET; NODE_ENV la scambierebbe per
// produzione. VERCEL_ENV invece è impostato solo da Vercel.
//
// Fail-closed: è "protetto" qualunque deploy su Vercel (produzione,
// anteprime, valori sconosciuti, oppure VERCEL presente senza
// VERCEL_ENV), tranne `vercel dev` in locale (VERCEL_ENV=development).
// Le anteprime sono URL pubblici anch'essi: senza secret non devono far
// partire email. Resta aperto solo dove nessuna variabile di Vercel c'è:
// in locale (`next dev`) e nella CI.
export function richiedeSecretCron(ambiente: AmbienteCron): boolean {
  if (ambiente.vercelEnv) return ambiente.vercelEnv !== 'development';
  return Boolean(ambiente.vercel);
}

function digest(valore: string): Buffer {
  return createHash('sha256').update(valore, 'utf8').digest();
}

// Vero se la chiamata al cron è autorizzata.
// - Con CRON_SECRET: serve esattamente `Authorization: Bearer <secret>`
//   (lo invia da sé Vercel Cron). Il confronto è a tempo costante e sui
//   digest SHA-256 di entrambi i valori, così lunghezze diverse non
//   lanciano eccezioni in timingSafeEqual e non si rivela la lunghezza.
// - Senza CRON_SECRET (assente, vuoto o di soli spazi): rifiuta tutto se
//   l'ambiente è protetto (vedi richiedeSecretCron), altrimenti lascia
//   passare come prima (comodo in locale).
// Nessun log qui: il chiamante risponde con un 401 generico, senza dire
// perché.
export function decidiAutorizzazioneCron({
  secret,
  authorization,
  ambiente,
}: {
  secret: string | undefined;
  authorization: string | null | undefined;
  ambiente: AmbienteCron;
}): boolean {
  if (!secret || !secret.trim()) return !richiedeSecretCron(ambiente);
  if (!authorization) return false;
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`));
}
