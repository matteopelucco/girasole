export type StatoPresenza = 'presente' | 'assente' | 'malattia';
export type StatoPasto = 'si' | 'no';

export type RigaPerConsistenza = {
  stato?: StatoPresenza;
  preAsilo?: boolean;
  postAsilo?: boolean;
  mangiato?: StatoPasto;
};

// Controllo di consistenza per una singola riga giorno/bambino (specs/06 -
// controllo-consistenza.md): funzione pura, nessun I/O, riusata da UI
// (Presenze, Pasti, drill-down Report) e dai report (a schermo e via
// email) tramite lib/report.ts:aggregaConteggiPresenzePasti, così le
// stesse regole non vengono ridefinite in più punti (CLAUDE.md, jscpd).
//
// Nota: "presente" + "assente"/"malattia" contemporaneamente non è
// verificato qui perché strutturalmente impossibile — sono valori
// alternativi di un'unica colonna `stato`, non flag indipendenti.
export function inconsistenzeGiorno(riga: RigaPerConsistenza): string[] {
  const problemi: string[] = [];

  if (riga.preAsilo && riga.stato !== 'presente') {
    problemi.push('Pre-asilo segnato ma il bambino non risulta presente.');
  }
  if (riga.postAsilo && riga.stato !== 'presente') {
    problemi.push('Post-asilo segnato ma il bambino non risulta presente.');
  }
  if (riga.mangiato === 'si' && riga.stato === 'assente') {
    problemi.push('Pasto segnato "sì" ma il bambino risulta assente.');
  }
  if (riga.mangiato === 'si' && riga.stato === 'malattia') {
    problemi.push('Pasto segnato "sì" ma il bambino risulta malato.');
  }

  return problemi;
}

export type BambinoConIncoerenze = { id: string; nome: string; cognome: string; problemi: string[] };

// Bambini con almeno un'incoerenza tra un insieme di righe giorno/bambino
// (specs/16 - comunicazione-pasti-rojac.md): la comunicazione dei pasti
// a Rojac è bloccata finché ne esiste anche uno (pasti segnati > presenti).
// Funzione pura: chi chiama (lib/pastiRojac.ts) ha già letto i dati
// dell'intero asilo; qui solo la regola, riusando inconsistenzeGiorno.
export function bambiniConIncoerenze(
  righe: (RigaPerConsistenza & { id: string; nome: string; cognome: string })[]
): BambinoConIncoerenze[] {
  return righe
    .map(({ id, nome, cognome, ...riga }) => ({ id, nome, cognome, problemi: inconsistenzeGiorno(riga) }))
    .filter((b) => b.problemi.length > 0);
}

// Riga grezza restituita dalla RPC `bambini_incoerenti_asilo` (migration
// 0056): un bambino attivo GIÀ incoerente (il filtro SQL replica i casi di
// inconsistenzeGiorno, vedi la migration), con presenza e pasto della data
// (null se la riga corrispondente non esiste). I messaggi si compongono
// qui.
export type RigaIncoerenzaDb = {
  id: string;
  nome: string;
  cognome: string;
  stato: StatoPresenza | null;
  pre_asilo: boolean | null;
  post_asilo: boolean | null;
  mangiato: string | null;
};

// Dalle righe grezze della RPC ai bambini con incoerenze, riusando
// bambiniConIncoerenze (stessa regola, nessuna duplicazione). Funzione
// pura, con unit test.
export function bambiniConIncoerenzeDaRighe(righe: RigaIncoerenzaDb[]): BambinoConIncoerenze[] {
  return bambiniConIncoerenze(
    righe.map((r) => ({
      id: r.id,
      nome: r.nome,
      cognome: r.cognome,
      stato: r.stato ?? undefined,
      preAsilo: r.pre_asilo ?? undefined,
      postAsilo: r.post_asilo ?? undefined,
      mangiato: (r.mangiato as StatoPasto | null) ?? undefined,
    }))
  );
}
