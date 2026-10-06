import { AZIONI_AVANZATE } from './impostazioniAvanzate';

export type VoceMenu = {
  href: string;
  etichetta: string;
  icona: string;
  // Altri percorsi che tengono evidenziata la voce (es. le pagine delle
  // azioni elencate da una pagina intermedia).
  percorsiCorrelati?: string[];
};

// Gruppo di voci (specs/60): solo un'intestazione, senza pagina propria,
// con sotto le voci figlie (es. "Pagamenti" > "Rette", "Pagamenti bambino").
export type GruppoMenu = {
  etichetta: string;
  icona: string;
  figli: VoceMenu[];
};

export type ElementoMenu = VoceMenu | GruppoMenu;

export function eGruppo(elemento: ElementoMenu): elemento is GruppoMenu {
  return 'figli' in elemento;
}

// Tutte le voci cliccabili, con i gruppi "appiattiti" nei loro figli.
export function vociLink(elementi: ElementoMenu[]): VoceMenu[] {
  return elementi.flatMap((e) => (eGruppo(e) ? e.figli : [e]));
}

// Costruisce l'elenco delle voci della sidebar in base al ruolo. Funzione
// pura (nessuna query, nessun redirect): la navigazione per maestra/
// assistente/genitore resta quella via le card della dashboard (vedi
// lib/dashboardSezioni.ts), qui c'è solo il link "Dashboard" per tornare
// alla home; l'admin ha in più le voci di amministrazione già presenti in
// passato nella barra orizzontale (vedi specs/01 - ux.md).
export function vociMenu(ruolo: string | null | undefined): ElementoMenu[] {
  const voci: ElementoMenu[] = [{ href: '/dashboard', etichetta: 'Dashboard', icona: '🏠' }];

  if (ruolo === 'admin') {
    voci.push(
      { href: '/admin', etichetta: 'Sezioni e bambini', icona: '🏫' },
      { href: '/admin/maestre', etichetta: 'Utenti', icona: '👥' },
      { href: '/admin/calendario', etichetta: 'Calendario scolastico', icona: '📅' },
      { href: '/admin/profili-orari', etichetta: 'Profili orari', icona: '🕒' },
      { href: '/admin/ore-lavoro', etichetta: 'Ore di lavoro del personale', icona: '⏱️' },
      // Gruppo "Pagamenti" (specs/60): "Rette" (specs/56) e "Pagamenti bambino".
      {
        etichetta: 'Pagamenti',
        icona: '💶',
        figli: [
          { href: '/admin/rette', etichetta: 'Rette', icona: '🧾' },
          { href: '/admin/pagamenti-bambino', etichetta: 'Pagamenti bambino', icona: '👶' },
        ],
      },
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

// Vero se la destinazione di un link coincide con la pagina corrente
// (stesso percorso e stessa query): in quel caso non c'è navigazione e la
// barra di caricamento non deve partire (issue #241). La query si accetta
// con o senza "?" iniziale (`URL.search` lo include, `searchParams.toString()`
// no), così "/dashboard" e "/dashboard?" risultano uguali.
export function eStessaPagina(
  pathnameDestinazione: string,
  queryDestinazione: string,
  pathnameCorrente: string,
  queryCorrente: string
): boolean {
  const senzaPunto = (q: string) => (q.startsWith('?') ? q.slice(1) : q);
  return (
    pathnameDestinazione === pathnameCorrente &&
    senzaPunto(queryDestinazione) === senzaPunto(queryCorrente)
  );
}

export type VoceMenuConStato =VoceMenu & { attivo: boolean };
export type GruppoMenuConStato = Omit<GruppoMenu, 'figli'> & { figli: VoceMenuConStato[] };
export type ElementoMenuConStato = VoceMenuConStato | GruppoMenuConStato;

export function eGruppoConStato(elemento: ElementoMenuConStato): elemento is GruppoMenuConStato {
  return 'figli' in elemento;
}

// Determina quale voce evidenziare come "attiva" per il pathname corrente:
// la voce il cui href è prefisso più lungo del pathname (così
// "/admin/maestre/xyz" evidenzia "Utenti" e non "Sezioni e bambini", pur
// avendo entrambe "/admin" come prefisso). Pura, nessun accesso a
// window/router: prende il pathname già risolto da chi chiama.
export function vociMenuConStato(
  ruolo: string | null | undefined,
  pathname: string
): ElementoMenuConStato[] {
  const elementi = vociMenu(ruolo);
  const voci = vociLink(elementi);

  const corrisponde = (percorso: string) => pathname === percorso || pathname.startsWith(`${percorso}/`);
  // Per ogni voce, il percorso (proprio o correlato) più lungo che corrisponde.
  const lunghezzaMatch = (v: VoceMenu) =>
    Math.max(-1, ...[v.href, ...(v.percorsiCorrelati ?? [])].filter(corrisponde).map((p) => p.length));
  const migliore = voci.reduce<VoceMenu | undefined>(
    (best, v) => (lunghezzaMatch(v) > (best ? lunghezzaMatch(best) : -1) ? v : best),
    undefined
  );

  const conStato = (v: VoceMenu): VoceMenuConStato => ({ ...v, attivo: v.href === migliore?.href });
  return elementi.map((e) => (eGruppo(e) ? { ...e, figli: e.figli.map(conStato) } : conStato(e)));
}
