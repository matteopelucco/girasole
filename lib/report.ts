import {
  oggi,
  meseDaData,
  primoGiornoMese,
  ultimoGiornoMese,
  meseSuccessivo,
  mesePrecedente,
  formattaMeseItaliano,
  lunediSettimana,
  domenicaSettimana,
  sommaGiorni,
  formattaIntervalloItaliano,
  formattaDataItaliana,
} from '@/lib/date';

export type TipoReport = 'mensile' | 'settimanale' | 'giornaliero';

export type PeriodoReport = {
  inizio: string;
  fine: string;
  etichettaPeriodo: string;
  periodoPrecedente: string;
  periodoSuccessivo: string;
  periodoAttuale: string;
};

// Risolve un periodo di report (specs/51 - report.md) a partire dal tipo
// e dal parametro `periodo` in query string: un mese "YYYY-MM" per il
// mensile, un giorno qualunque della settimana come ancora "YYYY-MM-DD"
// per il settimanale, un giorno "YYYY-MM-DD" per il giornaliero.
// Condiviso tra la pagina report principale e il drill-down su un
// bambino, che devono calcolare esattamente lo stesso intervallo.
export function risolviPeriodoReport(tipo: TipoReport, periodo: string | undefined): PeriodoReport {
  const oggiData = oggi();

  if (tipo === 'mensile') {
    const mese = periodo && /^\d{4}-\d{2}$/.test(periodo) ? periodo : meseDaData(oggiData);
    return {
      inizio: primoGiornoMese(mese),
      fine: ultimoGiornoMese(mese),
      etichettaPeriodo: formattaMeseItaliano(mese),
      periodoPrecedente: mesePrecedente(mese),
      periodoSuccessivo: meseSuccessivo(mese),
      periodoAttuale: mese,
    };
  }

  if (tipo === 'settimanale') {
    const ancora = periodo && /^\d{4}-\d{2}-\d{2}$/.test(periodo) ? periodo : oggiData;
    const inizio = lunediSettimana(ancora);
    const fine = domenicaSettimana(ancora);
    return {
      inizio,
      fine,
      etichettaPeriodo: formattaIntervalloItaliano(inizio, fine),
      periodoPrecedente: sommaGiorni(inizio, -7),
      periodoSuccessivo: sommaGiorni(inizio, 7),
      periodoAttuale: inizio,
    };
  }

  const giorno = periodo && /^\d{4}-\d{2}-\d{2}$/.test(periodo) ? periodo : oggiData;
  return {
    inizio: giorno,
    fine: giorno,
    etichettaPeriodo: formattaDataItaliana(giorno),
    periodoPrecedente: sommaGiorni(giorno, -1),
    periodoSuccessivo: sommaGiorni(giorno, 1),
    periodoAttuale: giorno,
  };
}

export type RigaReportBambino = {
  id: string;
  nome: string;
  cognome: string;
  presenze: number;
  preAsilo: number;
  postAsilo: number;
  pasti: number;
};

// Aggrega presenze/pasti di un periodo per bambino (specs/51 - report.md):
// funzione pura, nessun I/O — chi chiama (la pagina Report, il job
// notturno di specs/52 - report-email-automatico.md) ha già eseguito le
// query e passa solo le righe. Condivisa tra i due, per non duplicare
// la stessa logica di conteggio (CLAUDE.md, sezione jscpd).
export function aggregaConteggiPresenzePasti(
  bambini: { id: string; nome: string; cognome: string }[],
  presenze: { bambino_id: string; stato: string; pre_asilo?: boolean; post_asilo?: boolean }[],
  pasti: { bambino_id: string; mangiato: string }[]
): RigaReportBambino[] {
  const conteggi = new Map<string, { presenze: number; preAsilo: number; postAsilo: number; pasti: number }>();
  const contaBambino = (id: string) => {
    let voce = conteggi.get(id);
    if (!voce) {
      voce = { presenze: 0, preAsilo: 0, postAsilo: 0, pasti: 0 };
      conteggi.set(id, voce);
    }
    return voce;
  };

  for (const p of presenze) {
    if (p.stato !== 'presente') continue;
    const voce = contaBambino(p.bambino_id);
    voce.presenze += 1;
    if (p.pre_asilo) voce.preAsilo += 1;
    if (p.post_asilo) voce.postAsilo += 1;
  }
  for (const p of pasti) {
    if (p.mangiato !== 'si') continue;
    contaBambino(p.bambino_id).pasti += 1;
  }

  return bambini.map((b) => {
    const voce = conteggi.get(b.id) ?? { presenze: 0, preAsilo: 0, postAsilo: 0, pasti: 0 };
    return { id: b.id, nome: b.nome, cognome: b.cognome, ...voce };
  });
}
