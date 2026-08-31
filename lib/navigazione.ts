export type VoceMenu = {
  href: string;
  etichetta: string;
  icona: string;
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
      { href: '/admin/profili-orari', etichetta: 'Profili orari', icona: '🕒' }
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

  const corrispondenti = voci.filter(
    (v) => pathname === v.href || pathname.startsWith(`${v.href}/`)
  );
  const migliore = corrispondenti.sort((a, b) => b.href.length - a.href.length)[0];

  return voci.map((v) => ({ ...v, attivo: v.href === migliore?.href }));
}
