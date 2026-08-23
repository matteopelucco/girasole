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
