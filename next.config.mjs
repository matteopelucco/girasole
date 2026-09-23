import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Valori "fonte unica" per il footer versione (vedi lib/versione.ts):
// calcolati una sola volta qui, al caricamento di questo file — che
// avviene sia per `next dev` sia per `next build`/`next start`,
// indipendentemente da come il comando è invocato (npm run build,
// direttamente `next build`, ecc., a differenza di uno script "prebuild"
// che dipende da un hook npm) — e iniettati in process.env tramite
// l'opzione `env`. Next.js sostituisce queste chiavi con il loro valore
// letterale nel bundle a build-time (sia lato server che lato client,
// anche senza prefisso NEXT_PUBLIC_): non sono quindi rilette ad ogni
// richiesta, ma restano fisse per tutta la vita del deploy.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));

// Su Vercel, VERCEL_GIT_COMMIT_SHA è già disponibile a build-time senza
// bisogno di attivare "Automatically expose System Environment Variables"
// (quel toggle serve solo per le varianti NEXT_PUBLIC_*, necessarie se il
// valore va letto lato client — qui il footer è reso solo server-side,
// quindi la variabile senza prefisso basta). In locale (npm run dev/build)
// quella variabile non esiste: fallback allo SHA del commit HEAD via git,
// e se anche quello fallisce (repo non-git, git non installato) un
// placeholder esplicito.
function ottieniShaCommit() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA;
  }
  try {
    return execSync('git rev-parse HEAD', { cwd: __dirname }).toString().trim();
  } catch {
    return 'sviluppo-locale';
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    GIRASOLE_VERSIONE_APP: packageJson.version,
    GIRASOLE_BUILD_SHA: ottieniShaCommit(),
    GIRASOLE_BUILD_TIMESTAMP: new Date().toISOString(),
  },
};

export default nextConfig;
