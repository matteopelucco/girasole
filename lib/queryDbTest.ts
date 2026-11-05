// Girasole — logica pura per interrogare il database locale della CI (issue
// #419). L'I/O (psql, Management API) vive in `scripts/query-db-test.mts`.

const HOST_LOCALI = new Set(['127.0.0.1', 'localhost']);

// Sicurezza: un indirizzo che non è su questo computer viene rifiutato, così
// questa strada non può mai portare i controlli verso un database remoto.
export function urlDbLocaleValido(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return (protocol === 'postgres:' || protocol === 'postgresql:') && HOST_LOCALI.has(hostname);
  } catch {
    return false;
  }
}

// Un solo valore JSON con tutte le righe: stessa forma della risposta della
// Management API, così i controlli leggono i due casi allo stesso modo.
export function sqlRigheJson(query: string): string {
  return `select coalesce(json_agg(t), '[]'::json) from (${query}) t`;
}
