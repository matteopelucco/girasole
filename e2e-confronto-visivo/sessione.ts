// Percorso della sessione admin salvata da accesso.setup.ts (cartella
// playwright/.auth/, già ignorata da git).
import path from 'node:path';

export const SESSIONE_ADMIN = path.join(
  process.cwd(),
  'playwright',
  '.auth',
  'confronto-visivo-admin.json'
);
