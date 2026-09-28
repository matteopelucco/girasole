// Logica pura della schermata unica "Presenze e pasti" (specs/10 -
// presenze-e-pasti.md): nessun I/O, chi chiama (la pagina, la
// dashboard, i vecchi indirizzi che reindirizzano) ha già letto i dati.

export const PERCORSO_GIORNATA = '/dashboard/giornata';

// Indirizzo della schermata unica per una data (senza data: quella
// odierna, decisa dalla pagina). Usato dalla card in dashboard, dai link
// degli allarmi (specs/07) e dai vecchi indirizzi /dashboard/presenze e
// /dashboard/pasti, che reindirizzano qui mantenendo la data.
export function percorsoGiornata(data?: string | null): string {
  return data ? `${PERCORSO_GIORNATA}?data=${encodeURIComponent(data)}` : PERCORSO_GIORNATA;
}

export type StatoGiornoBambino = {
  stato?: string | null;
  preAsilo?: boolean | null;
  postAsilo?: boolean | null;
  mangiato?: string | null;
};

export type RiepilogoGiornata = {
  // "Presenti: presenti/totale" (specs/13).
  presenti: number;
  totale: number;
  // "Pre-asilo: preAsilo", "Post-asilo: postAsilo" (specs/13).
  preAsilo: number;
  postAsilo: number;
  // Pasti "sì" dei bambini non assenti/malati, e quanti sono questi
  // ultimi (specs/14). Il denominatore di "Pasti: X/Y" dipende da dove
  // si mostra: `pastiApplicabili` nella card di una sezione (specs/14),
  // `totale` nel riepilogo aggregato (specs/12, scelta esplicita).
  pastiSi: number;
  pastiApplicabili: number;
};

function assenteOMalato(stato: string | null | undefined): boolean {
  return stato === 'assente' || stato === 'malattia';
}

// Conteggi di un gruppo di bambini (una sezione, o tutte quelle visibili)
// per la data mostrata: stesse definizioni dei riepiloghi separati di
// Presenze e Pasti, ora in un'unica card.
export function riepilogoGiornata(righe: StatoGiornoBambino[]): RiepilogoGiornata {
  const applicabili = righe.filter((r) => !assenteOMalato(r.stato));
  return {
    presenti: righe.filter((r) => r.stato === 'presente').length,
    totale: righe.length,
    preAsilo: righe.filter((r) => r.preAsilo).length,
    postAsilo: righe.filter((r) => r.postAsilo).length,
    pastiSi: applicabili.filter((r) => r.mangiato === 'si').length,
    pastiApplicabili: applicabili.length,
  };
}

// Titolo della card riepilogo sopra un gruppo di bambini: "Sezione
// {nome}", senza prefisso per il gruppo "Senza sezione" (solo admin).
export function titoloRiepilogoSezione(titoloGruppo: string): string {
  return titoloGruppo === 'Senza sezione' ? titoloGruppo : `Sezione ${titoloGruppo}`;
}

// Stile dell'intestazione della card bambino in base a `bambini.sesso`
// (specs/10, issue #106): rosa tenue per le femmine, azzurro tenue per i
// maschi, neutro se il sesso non è compilato (o ha un valore inatteso).
// Classi Tailwind letterali: Tailwind genera solo le classi che trova
// come testo nei file scansionati (lib/** è incluso, vedi
// tailwind.config.ts). `etichetta` è null quando non c'è sesso: niente
// icona né scritta, solo lo sfondo neutro.
export type StileSesso = {
  sesso: 'F' | 'M' | null;
  etichetta: 'Femmina' | 'Maschio' | null;
  bordoCard: string;
  sfondoIntestazione: string;
  testoEtichetta: string;
};

export function stileSesso(sesso: string | null | undefined): StileSesso {
  if (sesso === 'F') {
    return {
      sesso: 'F',
      etichetta: 'Femmina',
      bordoCard: 'border-pink-200',
      sfondoIntestazione: 'bg-pink-100',
      testoEtichetta: 'text-pink-800',
    };
  }
  if (sesso === 'M') {
    return {
      sesso: 'M',
      etichetta: 'Maschio',
      bordoCard: 'border-sky-200',
      sfondoIntestazione: 'bg-sky-100',
      testoEtichetta: 'text-sky-800',
    };
  }
  return {
    sesso: null,
    etichetta: null,
    bordoCard: 'border-stone-200',
    sfondoIntestazione: 'bg-stone-50',
    testoEtichetta: 'text-stone-600',
  };
}
