import { AZIONI_AVANZATE } from './impostazioniAvanzate';

export type VoceMenu = {
  href: string;
  etichetta: string;
  icona: string;
  // Altri percorsi che tengono evidenziata la voce (es. le pagine delle
  // azioni elencate da una pagina intermedia).
  percorsiCorrelati?: string[];
};

// Costruisce l'elenco delle voci della sidebar in base al ruolo. Funzione
// pura (nessuna query, nessun redirect): la navigazione per maestra/
// assistente/genitore resta quella via le card della dashboard (vedi
// lib/dashboardSezioni.ts), qui c'è solo il link "Dashboard" per tornare
// alla home; l'admin ha in più le voci di amministrazione già presenti in
// passato nella barra orizzontale (vedi specs/01 - ux.md).
export function vociMenu(ruolo: string | null | undefined): VoceMenu[] {
  const voci: VoceMenu[] = [{ href: '/dashboard', etichetta: 'Dashboard', icona: '🏠' }];

  if (ruolo === 'admin') {
    voci.push(
      { href: '/admin', etichetta: 'Sezioni e bambini', icona: '🏫' },
      { href: '/admin/maestre', etichetta: 'Utenti', icona: '👥' },
      { href: '/admin/calendario', etichetta: 'Calendario scolastico', icona: '📅' },
      { href: '/admin/profili-orari', etichetta: 'Profili orari', icona: '🕒' },
      { href: '/admin/ore-lavoro', etichetta: 'Ore di lavoro del personale', icona: '⏱️' },
      { href: '/admin/rette', etichetta: 'Rette', icona: '💶' },
      // Ultima voce (specs/57): pagina intermedia con le azioni avanzate, tra cui il reset.
      {
        href: '/admin/impostazioni-avanzate',
        etichetta: 'Impostazioni avanzate',
        icona: '⚙️',
        percorsiCorrelati: AZIONI_AVANZATE.map((a) => a.href),
      }
    );
  }

  return voci;
}

// Determina quale voce evidenziare come "attiva" per il pathname corrente:
// la voce il cui href è prefisso più lungo del pathname (così
// "/admin/maestre/xyz" evidenzia "Utenti" e non "Sezioni e bambini", pur
// avendo entrambe "/admin" come prefisso). Pura, nessun accesso a
// window/router: prende il pathname già risolto da chi chiama.
export function vociMenuConStato(
  ruolo: string | null | undefined,
  pathname: string
): (VoceMenu & { attivo: boolean })[] {
  const voci = vociMenu(ruolo);

  const corrisponde = (percorso: string) => pathname === percorso || pathname.startsWith(`${percorso}/`);
  // Per ogni voce, il percorso (proprio o correlato) più lungo che corrisponde.
  const lunghezzaMatch = (v: VoceMenu) =>
    Math.max(-1, ...[v.href, ...(v.percorsiCorrelati ?? [])].filter(corrisponde).map((p) => p.length));
  const migliore = voci.reduce<VoceMenu | undefined>(
    (best, v) => (lunghezzaMatch(v) > (best ? lunghezzaMatch(best) : -1) ? v : best),
    undefined
  );

  return voci.map((v) => ({ ...v, attivo: v.href === migliore?.href }));
}
