import { meseSuccessivo } from '@/lib/date';

// Calcolo completo del monte ore "mese per mese" (specs/19): logica
// pura, nessun I/O — le query stanno in lib/monteOreMensileDati.ts. Il
// saldo è solo la somma dei movimenti registrati a mano dall'admin; la
// differenza ore è informativa e non lo modifica mai.

export type RigaCalcoloMensileMonteOre = {
  mese: string; // AAAA-MM
  orePreviste: number;
  // Ore fatte in più (+) o in meno (−) rispetto al previsto.
  differenza: number;
  // Somma delle variazioni dei movimenti registrati in quel mese.
  movimenti: number;
  // Saldo di monte ore a fine mese (movimenti cumulati).
  saldo: number;
};

function arrotonda(valore: number): number {
  return Math.round(valore * 100) / 100 + 0;
}

// Data (AAAA-MM-GG) di registrazione di un movimento, nel fuso
// Europe/Rome come il resto dell'app. Funzione pura.
export function dataDiMovimento(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
}

// Mese (AAAA-MM) di un movimento: un movimento registrato a cavallo della
// mezzanotte UTC appartiene al mese locale. Funzione pura.
export function meseDiMovimento(createdAt: string): string {
  return dataDiMovimento(createdAt).slice(0, 7);
}

// Una riga per ogni mese dal primo con ore o movimenti fino a
// `meseCorrente` (mesi intermedi senza dati inclusi, a zero). Funzione
// pura.
export function calcoloMensileMonteOre({
  mesi,
  movimenti,
  meseCorrente,
}: {
  mesi: { mese: string; orePreviste: number; differenza: number }[];
  movimenti: { variazione: number | string; created_at: string }[];
  meseCorrente: string;
}): RigaCalcoloMensileMonteOre[] {
  const perMese = new Map<string, { orePreviste: number; differenza: number; movimenti: number }>();
  const voce = (mese: string) => {
    let v = perMese.get(mese);
    if (!v) {
      v = { orePreviste: 0, differenza: 0, movimenti: 0 };
      perMese.set(mese, v);
    }
    return v;
  };

  for (const m of mesi) {
    const v = voce(m.mese);
    v.orePreviste += m.orePreviste;
    v.differenza += m.differenza;
  }
  for (const mov of movimenti) {
    voce(meseDiMovimento(mov.created_at)).movimenti += Number(mov.variazione);
  }
  if (!perMese.size) return [];

  const primo = [...perMese.keys()].sort()[0];
  const ultimo = [...perMese.keys(), meseCorrente].sort().at(-1)!;

  const righe: RigaCalcoloMensileMonteOre[] = [];
  let saldo = 0;
  for (let mese = primo; mese <= ultimo; mese = meseSuccessivo(mese)) {
    const v = perMese.get(mese) ?? { orePreviste: 0, differenza: 0, movimenti: 0 };
    saldo += v.movimenti;
    righe.push({
      mese,
      orePreviste: arrotonda(v.orePreviste),
      differenza: arrotonda(v.differenza),
      movimenti: arrotonda(v.movimenti),
      saldo: arrotonda(saldo),
    });
  }
  return righe;
}
