// Girasole — guardia del giro di fumo sull'anteprima di Vercel (issue #267).
//
// Perché esiste: il workflow `.github/workflows/anteprima-fumo.yml` parte
// quando Vercel finisce un deploy e lancia Playwright, con gli account di
// test E2E_*, sull'indirizzo che l'evento gli consegna. Prima di toccare
// qualunque cosa questa guardia decide se l'indirizzo e il contesto sono
// quelli giusti. Regola di fondo: nel dubbio NON si lancia nulla. Il giro
// scrive nel DB di test (avvisi di prova, poi cancellati) e non deve mai
// puntare alla produzione né a un deploy che non viene da una PR di questo
// repo (un fork potrebbe far girare codice proprio con i nostri secret).
//
// Logica pura (nessun I/O): la leggono lo script del workflow
// (`scripts/guardia-anteprima.mts`) e la configurazione Playwright dedicata
// (`playwright.anteprima.config.ts`, così anche un giro lanciato a mano in
// locale rifiuta la produzione). Vedi docs/sviluppo-dettagli.md.

export type EsitoGuardia = { ok: true; url: string } | { ok: false; motivo: string };
export type EsitoControllo = { ok: true } | { ok: false; motivo: string };

// Nome del progetto Vercel: gli indirizzi di anteprima sono
// `girasole-<hash>-<squadra>.vercel.app` e, per ramo,
// `girasole-git-<ramo>-<squadra>.vercel.app`.
export const PROGETTO_VERCEL = 'girasole';

// Alias di produzione del progetto. Un dominio proprio (non *.vercel.app)
// è comunque escluso dalla regola sul dominio.
export const HOST_PRODUZIONE: readonly string[] = ['girasole.vercel.app'];

const HOST_ANTEPRIMA = new RegExp(`^${PROGETTO_VERCEL}-[a-z0-9]+(-[a-z0-9]+)*\\.vercel\\.app$`);
// L'indirizzo di ramo del ramo di produzione serve la produzione.
const PREFISSO_RAMO_PRODUZIONE = `${PROGETTO_VERCEL}-git-main-`;

function rifiuto(motivo: string): { ok: false; motivo: string } {
  return { ok: false, motivo };
}

/**
 * L'indirizzo è quello di una anteprima Vercel di questo progetto?
 * Restituisce l'origine normalizzata (senza percorso né parametri).
 */
export function valutaUrlAnteprima(url: string | null | undefined): EsitoGuardia {
  if (!url || !url.trim()) return rifiuto('Indirizzo dell\'anteprima mancante.');

  let analizzato: URL;
  try {
    analizzato = new URL(url.trim());
  } catch {
    return rifiuto('Indirizzo dell\'anteprima non valido.');
  }

  if (analizzato.protocol !== 'https:') {
    return rifiuto(`L'indirizzo ${analizzato.origin} non usa https.`);
  }
  if (analizzato.username || analizzato.password) {
    return rifiuto('L\'indirizzo contiene credenziali: rifiutato.');
  }
  if (analizzato.port) {
    return rifiuto(`L'indirizzo ${analizzato.origin} usa una porta esplicita: rifiutato.`);
  }

  const host = analizzato.hostname.toLowerCase();
  if (HOST_PRODUZIONE.includes(host)) {
    return rifiuto(`${host} è la produzione: il giro di fumo non gira mai sulla produzione.`);
  }
  if (host.startsWith(PREFISSO_RAMO_PRODUZIONE)) {
    return rifiuto(`${host} è l'indirizzo del ramo di produzione (main): rifiutato.`);
  }
  if (!HOST_ANTEPRIMA.test(host)) {
    return rifiuto(
      `${host} non è un'anteprima Vercel di questo progetto (atteso ${PROGETTO_VERCEL}-<...>.vercel.app).`
    );
  }
  return { ok: true, url: `https://${host}` };
}

/** Il deploy è nell'ambiente "Preview" (mai "Production")? */
export function valutaAmbienteAnteprima(ambiente: string | null | undefined): EsitoControllo {
  const valore = (ambiente ?? '').trim();
  // Vercel scrive "Preview"; con più progetti sullo stesso repo aggiunge il
  // nome ("Preview – girasole").
  if (/^preview(\s*[–-]\s*\S.*)?$/i.test(valore)) return { ok: true };
  return rifiuto(`Ambiente "${valore || 'non indicato'}": serve Preview.`);
}

/**
 * Tutte le PR collegate al commit del deploy vengono da questo stesso
 * repository (nessun fork)? Con zero PR si rifiuta: se non si sa da dove
 * viene il codice, non si usano i secret.
 */
export function valutaRepoPrAnteprima(
  repository: string,
  repoTestaPr: readonly string[]
): EsitoControllo {
  const atteso = repository.trim().toLowerCase();
  if (!atteso) return rifiuto('Repository corrente sconosciuto.');
  if (repoTestaPr.length === 0) {
    return rifiuto('Nessuna PR di questo repository risulta collegata al commit dell\'anteprima.');
  }
  const estranei = repoTestaPr.filter((repo) => repo.trim().toLowerCase() !== atteso);
  if (estranei.length > 0) {
    return rifiuto(
      `La PR viene da un altro repository (fork o repository sconosciuto: ${estranei
        .map((r) => r.trim() || 'ignoto')
        .join(', ')}): il giro di fumo non parte.`
    );
  }
  return { ok: true };
}

export type DatiDeploymentAnteprima = {
  /** `owner/nome` del repository del workflow (github.repository). */
  repository: string;
  /** Stato del deploy (deployment_status.state). */
  stato: string;
  /** Ambiente del deploy (deployment.environment). */
  ambiente: string;
  /** Indirizzo del deploy (deployment_status.environment_url). */
  urlAnteprima: string;
  /** `owner/nome` del repository di partenza di ogni PR del commit. */
  repoTestaPr: readonly string[];
};

/** Tutti i controlli, nell'ordine; il primo che fallisce spiega il motivo. */
export function valutaDeploymentAnteprima(dati: DatiDeploymentAnteprima): EsitoGuardia {
  if (dati.stato.trim().toLowerCase() !== 'success') {
    return rifiuto(`Il deploy è in stato "${dati.stato}", non "success".`);
  }
  const ambiente = valutaAmbienteAnteprima(dati.ambiente);
  if (!ambiente.ok) return ambiente;
  const url = valutaUrlAnteprima(dati.urlAnteprima);
  if (!url.ok) return url;
  const pr = valutaRepoPrAnteprima(dati.repository, dati.repoTestaPr);
  if (!pr.ok) return pr;
  return url;
}
