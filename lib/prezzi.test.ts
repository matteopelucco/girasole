// Requisito: specs/62 (PRZ-03, PRZ-04, PRZ-07), specs/55 (COS-02, COS-05).
//
// API che `lib/prezzi.ts` deve esportare (logica pura, nessun I/O):
//
//   MESSAGGIO_IMPORTO_NON_VALIDO: string
//     = 'Inserisci un importo tra 0 e 9999,99 con al massimo due decimali'
//
//   parseImporto(testo: string): RisultatoImporto
//     RisultatoImporto = { ok: true; centesimi: number; valore: number }
//                      | { ok: false; errore: string }   // errore = MESSAGGIO_IMPORTO_NON_VALIDO
//     Importo obbligatorio (sezione "Prezzi"). Accetta virgola o punto come
//     separatore decimale, spazi esterni ignorati, da 0 a 9999,99 con al
//     massimo due decimali. Rifiuta (senza arrotondare né trasformare in 0):
//     vuoto, testo, negativi, piu' di 2 decimali, notazione scientifica,
//     separatore delle migliaia, simbolo "€", sopra 9999,99.
//     `centesimi` e' un intero esatto (es. 16550), `valore` = centesimi / 100.
//
//   parseImportoOpzionale(testo: string): RisultatoImporto
//     Come parseImporto, ma il vuoto (anche solo spazi) vale 0 (scheda Costi,
//     COS-05: "lasciando un prezzo vuoto, vale 0").
//
//   formattaImporto(valore: number): string
//     Due decimali con la virgola, senza migliaia e senza "€": 160 -> '160,00'.
//
// Allarme prezzi (specs/07, issue #397) - da aggiungere a lib/prezzi.ts:
//
//   nomePrezzo(colonna: ColonnaPrezzo): string
//     Etichetta di CAMPI_PREZZI senza " (€)": 'retta_materna' -> 'Retta Materna'.
//
//   valutaPrezziESezioni(
//     prezzi: Partial<Record<ColonnaPrezzo, number | null | undefined>> | null | undefined,
//     sezioni: { id: string; nome: string; tipo?: string | null; attiva?: boolean }[]
//   ): { prezziMancanti: ColonnaPrezzo[]; sezioniSenzaTipo: { id: string; nome: string }[]; daSistemare: boolean }
//     Prezzo null/undefined = mancante, 0 = valido; riga assente (null/undefined)
//     = tutti e otto mancanti. prezziMancanti nell'ordine di CAMPI_PREZZI,
//     sezioniSenzaTipo nell'ordine di input. Sezione senza tipo valido
//     (null, undefined, valore sconosciuto) = senza tipo; `attiva === false`
//     = ignorata. daSistemare = almeno un elenco non vuoto.
//
//   type TipoSezione = 'materna' | 'primavera'
//
//   rettaPerTipo(
//     tipo: TipoSezione | null | undefined,
//     prezzi: { rettaMaterna: number; rettaPrimavera: number }
//   ): number | null
//     Retta predefinita della sezione; null se manca il tipo (PRZ-07, PRZ-08,
//     COS-02: "vuota se manca il tipo").
import { describe, expect, it } from 'vitest';
import {
  MESSAGGIO_IMPORTO_NON_VALIDO,
  formattaImporto,
  parseImporto,
  parseImportoOpzionale,
  rettaPerTipo,
  CAMPI_PREZZI,
  nomePrezzo,
  valutaPrezziESezioni,
  copertoDaAbbonamento,
  statoGettone,
  gettoneFuoriRetta,
  gettoniMesePrecedente,
} from './prezzi';
import { calcolaRiepilogoRetta } from './comunicazioneRetta';
// Requisito: specs/19 (MOR-01..MOR-10). Questi test stanno in questo file solo
// perche' e' l'unico file di test di lib/ nel perimetro del test engineer: da
// spostare in lib/monteOreMensile.test.ts quando si implementa.
import {
  calcoloMensileMonteOre,
  meseDiCompetenza,
  notaConfermaMese,
  nuovaVariazioneConferma,
  parteNonConfermata,
  puoConfermareMese,
} from './monteOreMensile';

function centesimi(testo: string): number | null {
  const r = parseImporto(testo);
  return r.ok ? r.centesimi : null;
}

describe('MESSAGGIO_IMPORTO_NON_VALIDO', () => {
  it('e il testo della spec (PRZ-04)', () => {
    expect(MESSAGGIO_IMPORTO_NON_VALIDO).toBe('Inserisci un importo tra 0 e 9999,99 con al massimo due decimali');
  });
});

describe('parseImporto: valori accettati', () => {
  it.each([
    ['165,50', 16550],
    ['165.50', 16550],
    ['7', 700],
    ['0', 0],
    ['0,00', 0],
    ['0.01', 1],
    ['9999,99', 999999],
    ['9999.99', 999999],
    ['6,5', 650],
    ['160', 16000],
    ['  6  ', 600],
  ])('"%s" vale %i centesimi', (testo, atteso) => {
    expect(centesimi(testo)).toBe(atteso);
  });

  it('restituisce anche il valore in euro, senza errori di virgola mobile', () => {
    const r = parseImporto('165,50');
    expect(r).toEqual({ ok: true, centesimi: 16550, valore: 165.5 });
    // 0,29 * 100 in virgola mobile da' 28.999...: i centesimi devono essere esatti.
    expect(centesimi('0,29')).toBe(29);
    expect(centesimi('1,15')).toBe(115);
    expect(centesimi('19,99')).toBe(1999);
  });
});

describe('parseImporto: valori rifiutati (mai arrotondati, mai trasformati in 0)', () => {
  it.each([
    ['', 'vuoto'],
    ['   ', 'solo spazi'],
    ['abc', 'testo'],
    ['-1', 'negativo'],
    ['-0', 'zero negativo'],
    ['-0,01', 'negativo con decimali'],
    ['6,555', 'tre decimali'],
    ['6.555', 'tre decimali con punto'],
    ['9999,995', 'oltre il massimo per un soffio'],
    ['1e2', 'notazione scientifica'],
    ['1E2', 'notazione scientifica maiuscola'],
    ['1.234,50', 'separatore delle migliaia'],
    ['1,234.50', 'migliaia all\'americana'],
    ['10000', 'sopra il massimo'],
    ['10000,00', 'sopra il massimo con decimali'],
    ['9999,999', 'sopra il massimo'],
    ['€5', 'simbolo euro'],
    ['5 €', 'simbolo euro dopo'],
    ['5,', 'separatore senza decimali'],
    [',5', 'senza parte intera'],
    ['.5', 'senza parte intera con punto'],
    ['1,2,3', 'due separatori'],
    ['+5', 'segno positivo'],
    ['NaN', 'NaN'],
    ['Infinity', 'infinito'],
    ['0x10', 'esadecimale'],
    ['5 0', 'spazio in mezzo'],
  ])('"%s" (%s) e rifiutato col messaggio chiaro', (testo) => {
    expect(parseImporto(testo)).toEqual({ ok: false, errore: MESSAGGIO_IMPORTO_NON_VALIDO });
  });
});

describe('parseImportoOpzionale (scheda Costi, COS-05)', () => {
  it('il vuoto vale 0', () => {
    expect(parseImportoOpzionale('')).toEqual({ ok: true, centesimi: 0, valore: 0 });
    expect(parseImportoOpzionale('   ')).toEqual({ ok: true, centesimi: 0, valore: 0 });
  });

  it('"160,50" vale 160,50 come "160.50"', () => {
    expect(parseImportoOpzionale('160,50')).toEqual({ ok: true, centesimi: 16050, valore: 160.5 });
    expect(parseImportoOpzionale('160.50')).toEqual({ ok: true, centesimi: 16050, valore: 160.5 });
  });

  it.each(['abc', '-5', '160,555', '1e2', '1.234,50', '10000'])('"%s" e rifiutato, non diventa 0', (testo) => {
    expect(parseImportoOpzionale(testo)).toEqual({ ok: false, errore: MESSAGGIO_IMPORTO_NON_VALIDO });
  });

  it('"0" e un importo valido (non e il vuoto)', () => {
    expect(parseImportoOpzionale('0')).toEqual({ ok: true, centesimi: 0, valore: 0 });
  });
});

describe('formattaImporto', () => {
  it.each([
    [160, '160,00'],
    [200, '200,00'],
    [6, '6,00'],
    [165.5, '165,50'],
    [0, '0,00'],
    [9999.99, '9999,99'],
    [0.07, '0,07'],
  ])('%d diventa "%s"', (valore, atteso) => {
    expect(formattaImporto(valore)).toBe(atteso);
  });

  it('il testo formattato viene riletto allo stesso importo (andata e ritorno)', () => {
    for (const v of [0, 0.01, 6, 70, 160, 165.5, 1234.56, 9999.99]) {
      const r = parseImporto(formattaImporto(v));
      expect(r.ok && r.valore).toBe(v);
    }
  });
});

describe('rettaPerTipo (PRZ-07, PRZ-08, COS-02, COS-04)', () => {
  const prezzi = { rettaMaterna: 160, rettaPrimavera: 200 };

  it('materna prende la retta Materna', () => {
    expect(rettaPerTipo('materna', prezzi)).toBe(160);
  });

  it('primavera prende la retta Primavera', () => {
    expect(rettaPerTipo('primavera', prezzi)).toBe(200);
  });

  it('senza tipo non c\'e retta (null, non 0)', () => {
    expect(rettaPerTipo(null, prezzi)).toBeNull();
    expect(rettaPerTipo(undefined, prezzi)).toBeNull();
  });

  it('segue i prezzi passati, non valori fissi', () => {
    expect(rettaPerTipo('materna', { rettaMaterna: 165.5, rettaPrimavera: 210 })).toBe(165.5);
    expect(rettaPerTipo('primavera', { rettaMaterna: 165.5, rettaPrimavera: 210 })).toBe(210);
  });
});

const prezziCompleti = () => ({
  retta_materna: 160,
  retta_primavera: 200,
  buono_pasto: 6,
  marca_da_bollo: 2,
  abbonamento_pre_asilo: 70,
  abbonamento_post_asilo: 70,
  gettone_pre_asilo: 7,
  gettone_post_asilo: 7,
});

const sezione = (nome: string, tipo: string | null | undefined, extra: { attiva?: boolean } = {}) => ({
  id: `id-${nome}`,
  nome,
  tipo,
  ...extra,
});

describe('valutaPrezziESezioni - prezzi', () => {
  it('prezzi tutti impostati e nessuna sezione: niente da sistemare', () => {
    expect(valutaPrezziESezioni(prezziCompleti(), [])).toEqual({
      prezziMancanti: [],
      sezioniSenzaTipo: [],
      daSistemare: false,
    });
  });

  it('un prezzo nullo e mancante', () => {
    const esito = valutaPrezziESezioni({ ...prezziCompleti(), retta_materna: null }, []);
    expect(esito.prezziMancanti).toEqual(['retta_materna']);
    expect(esito.daSistemare).toBe(true);
  });

  it('un prezzo non presente (undefined) e mancante', () => {
    const { buono_pasto: _tolto, ...senzaBuono } = prezziCompleti();
    expect(valutaPrezziESezioni(senzaBuono, []).prezziMancanti).toEqual(['buono_pasto']);
  });

  it('un prezzo pari a 0 e un valore valido, non e mancante', () => {
    const esito = valutaPrezziESezioni({ ...prezziCompleti(), marca_da_bollo: 0, gettone_pre_asilo: 0 }, []);
    expect(esito.prezziMancanti).toEqual([]);
    expect(esito.daSistemare).toBe(false);
  });

  it("riga dei prezzi assente (null o undefined): mancano tutti e otto, nell'ordine del form", () => {
    for (const riga of [null, undefined]) {
      const esito = valutaPrezziESezioni(riga, []);
      expect(esito.prezziMancanti).toEqual(CAMPI_PREZZI.map((c) => c.colonna));
      expect(esito.prezziMancanti).toHaveLength(8);
      expect(esito.daSistemare).toBe(true);
    }
  });

  it("piu prezzi mancanti: elencati nell'ordine del form", () => {
    const esito = valutaPrezziESezioni({ ...prezziCompleti(), gettone_post_asilo: null, retta_primavera: null }, []);
    expect(esito.prezziMancanti).toEqual(['retta_primavera', 'gettone_post_asilo']);
  });
});

describe('valutaPrezziESezioni - sezioni', () => {
  it('sezioni tutte con un tipo: niente da sistemare', () => {
    const esito = valutaPrezziESezioni(prezziCompleti(), [sezione('Girasoli', 'materna'), sezione('Pulcini', 'primavera')]);
    expect(esito.sezioniSenzaTipo).toEqual([]);
    expect(esito.daSistemare).toBe(false);
  });

  it('una sezione senza tipo (null o undefined) e elencata con id e nome, anche con tutti i prezzi impostati', () => {
    const esito = valutaPrezziESezioni(prezziCompleti(), [
      sezione('Girasoli', 'materna'),
      sezione('Tulipani', null),
      sezione('Margherite', undefined),
    ]);
    expect(esito.prezziMancanti).toEqual([]);
    expect(esito.sezioniSenzaTipo).toEqual([
      { id: 'id-Tulipani', nome: 'Tulipani' },
      { id: 'id-Margherite', nome: 'Margherite' },
    ]);
    expect(esito.daSistemare).toBe(true);
  });

  it('un tipo sconosciuto conta come senza tipo', () => {
    const esito = valutaPrezziESezioni(prezziCompleti(), [sezione('Strana', 'altro')]);
    expect(esito.sezioniSenzaTipo).toEqual([{ id: 'id-Strana', nome: 'Strana' }]);
  });

  it('le sezioni non attive non contano', () => {
    const esito = valutaPrezziESezioni(prezziCompleti(), [sezione('Vecchia', null, { attiva: false })]);
    expect(esito.sezioniSenzaTipo).toEqual([]);
    expect(esito.daSistemare).toBe(false);
  });

  it('una sezione con attiva esplicitamente vera e senza tipo conta', () => {
    const esito = valutaPrezziESezioni(prezziCompleti(), [sezione('Nuova', null, { attiva: true })]);
    expect(esito.sezioniSenzaTipo).toEqual([{ id: 'id-Nuova', nome: 'Nuova' }]);
  });

  it('prezzi e sezioni mancanti insieme: entrambi gli elenchi', () => {
    const esito = valutaPrezziESezioni(null, [sezione('Tulipani', null)]);
    expect(esito.prezziMancanti).toHaveLength(8);
    expect(esito.sezioniSenzaTipo).toHaveLength(1);
    expect(esito.daSistemare).toBe(true);
  });
});

describe('nomePrezzo', () => {
  it("da il nome leggibile senza il simbolo dell'euro", () => {
    expect(nomePrezzo('retta_materna')).toBe('Retta Materna');
    expect(nomePrezzo('abbonamento_pre_asilo')).toBe('Abbonamento pre-asilo');
    expect(nomePrezzo('gettone_post_asilo')).toBe('Gettone post-asilo');
  });
});

// Copertura del pre/post-asilo (specs/13, GET-01..03, GET-11, GET-12; #399).
// Funzioni pure in lib/prezzi.ts. Flag attuale = abbonamento in costi_bambini;
// rettaDelMese = snapshot di comunicazioni_retta se già inviata, altrimenti null.
describe('copertoDaAbbonamento', () => {
  it('GET-01: senza retta inviata vale il flag attuale (attivo)', () => {
    expect(copertoDaAbbonamento({ voce: 'pre', flagAttuale: true, rettaDelMese: null })).toBe(true);
    expect(copertoDaAbbonamento({ voce: 'post', flagAttuale: true, rettaDelMese: null })).toBe(true);
  });

  it('GET-02: senza retta inviata e senza abbonamento non è coperto', () => {
    expect(copertoDaAbbonamento({ voce: 'pre', flagAttuale: false, rettaDelMese: null })).toBe(false);
    expect(copertoDaAbbonamento({ voce: 'post', flagAttuale: false, rettaDelMese: null })).toBe(false);
  });

  it("GET-03: l'abbonamento di una voce non copre l'altra", () => {
    expect(copertoDaAbbonamento({ voce: 'pre', flagAttuale: true, rettaDelMese: null })).toBe(true);
    expect(copertoDaAbbonamento({ voce: 'post', flagAttuale: false, rettaDelMese: null })).toBe(false);
  });

  it('GET-11: con la retta inviata conta il costo addebitato, non il flag (flag acceso, voce a zero)', () => {
    const retta = { costoPreAsilo: 0, costoPostAsilo: 70 };
    expect(copertoDaAbbonamento({ voce: 'pre', flagAttuale: true, rettaDelMese: retta })).toBe(false);
  });

  it('GET-11: con la retta inviata conta il costo addebitato (flag spento, voce addebitata)', () => {
    const retta = { costoPreAsilo: 0, costoPostAsilo: 70 };
    expect(copertoDaAbbonamento({ voce: 'post', flagAttuale: false, rettaDelMese: retta })).toBe(true);
  });

  it('GET-11: pre e post usano ciascuno la propria voce della retta', () => {
    const retta = { costoPreAsilo: 70, costoPostAsilo: 0 };
    expect(copertoDaAbbonamento({ voce: 'pre', flagAttuale: false, rettaDelMese: retta })).toBe(true);
    expect(copertoDaAbbonamento({ voce: 'post', flagAttuale: true, rettaDelMese: retta })).toBe(false);
  });
});

describe('statoGettone', () => {
  it('GET-01: coperto -> "coperto"', () => {
    expect(statoGettone(true)).toBe('coperto');
  });

  it('GET-02: non coperto -> "da_addebitare"', () => {
    expect(statoGettone(false)).toBe('da_addebitare');
  });
});

describe('gettoneFuoriRetta', () => {
  it('GET-12: attivo, non coperto e retta successiva inviata -> avviso', () => {
    expect(gettoneFuoriRetta({ attivo: true, coperto: false, rettaSuccessivaInviata: true })).toBe(true);
  });

  it('GET-12: nessun avviso se coperto', () => {
    expect(gettoneFuoriRetta({ attivo: true, coperto: true, rettaSuccessivaInviata: true })).toBe(false);
  });

  it('GET-12: nessun avviso se la retta successiva non è inviata', () => {
    expect(gettoneFuoriRetta({ attivo: true, coperto: false, rettaSuccessivaInviata: false })).toBe(false);
  });

  it('GET-12: nessun avviso se il pre/post-asilo è stato tolto', () => {
    expect(gettoneFuoriRetta({ attivo: false, coperto: false, rettaSuccessivaInviata: true })).toBe(false);
  });
});

// Gettoni del mese precedente nella retta (specs/56 RET-01..RET-05, RET-08; #400).
// API attesa in lib/prezzi.ts (logica pura, nessun I/O):
//
//   gettoniMesePrecedente(args: {
//     meseCorrente: string;                       // "YYYY-MM", il mese M della retta
//     presenze: { data: string; preAsilo: boolean; postAsilo: boolean }[];
//     chiusure: GiornoChiusura[];                 // lib/calendarioScolastico
//     costi: { preAsiloRichiesto: boolean; postAsiloRichiesto: boolean;
//              gettonePreAsilo: number; gettonePostAsilo: number } | null;  // null = nessuna riga costi_bambini
//     rettaMesePrecedente: { costoPreAsilo: number; costoPostAsilo: number } | null; // retta inviata di M-1
//   }): { pre: { numero: number; importo: number }; post: { numero: number; importo: number } }
//
//   Si contano i giorni di M-1 con pre (o post) vero, senza weekend né chiusure,
//   con la voce non coperta (copertoDaAbbonamento: GET-11), x gettone della voce;
//   le presenze fuori da M-1 si ignorano; costi null = 0 e 0. Importo arrotondato a 2 decimali.
//
// calcolaRiepilogoRetta (lib/comunicazioneRetta.ts) deve accettare i parametri
// `gettoniPreAsilo` e `gettoniPostAsilo` (importi, in euro) e restituirli nel riepilogo,
// sommandoli al totale.
describe('gettoniMesePrecedente', () => {
  const costi = { preAsiloRichiesto: false, postAsiloRichiesto: false, gettonePreAsilo: 7, gettonePostAsilo: 8 };
  const p = (data: string, preAsilo: boolean, postAsilo: boolean) => ({ data, preAsilo, postAsilo });
  // Settembre 2026: 1 = martedì, 5 = sabato, 6 = domenica. Agosto 2026: 3 = lunedì.
  const base = { meseCorrente: '2026-10', chiusure: [], costi, rettaMesePrecedente: null };

  it('RET-01: giorni non coperti x prezzo del gettone, per ogni voce (3 x 7 e 2 x 8)', () => {
    const presenze = [p('2026-09-01', true, true), p('2026-09-02', true, true), p('2026-09-03', true, false)];
    expect(gettoniMesePrecedente({ ...base, presenze })).toEqual({
      pre: { numero: 3, importo: 21 },
      post: { numero: 2, importo: 16 },
    });
  });

  it('RET-01: una voce senza giorni non coperti vale 0 e 0, e senza presenze sono entrambe zero', () => {
    expect(gettoniMesePrecedente({ ...base, presenze: [p('2026-09-01', true, false)] }).post).toEqual({
      numero: 0,
      importo: 0,
    });
    expect(gettoniMesePrecedente({ ...base, presenze: [] })).toEqual({
      pre: { numero: 0, importo: 0 },
      post: { numero: 0, importo: 0 },
    });
  });

  it('RET-01: le voci sono separate (solo pre o solo post)', () => {
    const presenze = [p('2026-09-01', true, false), p('2026-09-02', false, true)];
    expect(gettoniMesePrecedente({ ...base, presenze })).toEqual({
      pre: { numero: 1, importo: 7 },
      post: { numero: 1, importo: 8 },
    });
  });

  it('RET-01: importo arrotondato al centesimo (3 x 7,33)', () => {
    const presenze = [p('2026-09-01', true, false), p('2026-09-02', true, false), p('2026-09-03', true, false)];
    const r = gettoniMesePrecedente({ ...base, presenze, costi: { ...costi, gettonePreAsilo: 7.33 } });
    expect(r.pre).toEqual({ numero: 3, importo: 21.99 });
  });

  it('RET-02: senza retta di M-1 inviata vale il flag attuale: abbonamento pre acceso copre il pre, non il post', () => {
    const presenze = [p('2026-09-01', true, true), p('2026-09-02', true, true)];
    const r = gettoniMesePrecedente({ ...base, presenze, costi: { ...costi, preAsiloRichiesto: true } });
    expect(r.pre).toEqual({ numero: 0, importo: 0 });
    expect(r.post).toEqual({ numero: 2, importo: 16 });
  });

  it('RET-02: con la retta di M-1 inviata conta il costo addebitato, non il flag (flag acceso, costo a zero)', () => {
    const presenze = [p('2026-09-01', true, true)];
    const r = gettoniMesePrecedente({
      ...base,
      presenze,
      costi: { ...costi, preAsiloRichiesto: true },
      rettaMesePrecedente: { costoPreAsilo: 0, costoPostAsilo: 70 },
    });
    expect(r.pre).toEqual({ numero: 1, importo: 0 }); // non coperto (costo pre = 0), ma flag acceso: importo 0 (RET-13)
    expect(r.post).toEqual({ numero: 0, importo: 0 }); // coperto: costo post > 0, anche col flag spento
  });

  it("RET-02: pre e post sono valutati separatamente (l'abbonamento di una voce non copre l'altra)", () => {
    const presenze = [p('2026-09-01', true, true)];
    const r = gettoniMesePrecedente({
      ...base,
      presenze,
      rettaMesePrecedente: { costoPreAsilo: 70, costoPostAsilo: 0 },
    });
    expect(r.pre.numero).toBe(0);
    expect(r.post.numero).toBe(1);
  });

  // 14 giorni feriali di settembre 2026 (1-4, 7-11, 14-18), tutti con pre-asilo.
  const quattordici = [1, 2, 3, 4, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18].map((g) =>
    p(`2026-09-${String(g).padStart(2, '0')}`, true, false)
  );

  it('RET-13: abbonamento pre attivo con 14 giorni non coperti: numero 14, importo 0', () => {
    // Retta di M-1 inviata senza abbonamento pre (costo 0): i 14 giorni non erano coperti.
    const r = gettoniMesePrecedente({
      ...base,
      presenze: quattordici,
      costi: { ...costi, preAsiloRichiesto: true },
      rettaMesePrecedente: { costoPreAsilo: 0, costoPostAsilo: 0 },
    });
    expect(r.pre).toEqual({ numero: 14, importo: 0 });
  });

  it("RET-13: senza abbonamento della voce nel mese l'importo è numero x prezzo", () => {
    const r = gettoniMesePrecedente({ ...base, presenze: quattordici });
    expect(r.pre).toEqual({ numero: 14, importo: 98 });
  });

  it('RET-13: pre e post sono indipendenti (l\'abbonamento di una voce azzera solo quella)', () => {
    const presenze = [p('2026-09-01', true, true), p('2026-09-02', true, true)];
    const rettaSenzaAbbonamenti = { costoPreAsilo: 0, costoPostAsilo: 0 };
    const soloPost = gettoniMesePrecedente({
      ...base,
      presenze,
      costi: { ...costi, postAsiloRichiesto: true },
      rettaMesePrecedente: rettaSenzaAbbonamenti,
    });
    expect(soloPost).toEqual({ pre: { numero: 2, importo: 14 }, post: { numero: 2, importo: 0 } });
    const soloPre = gettoniMesePrecedente({
      ...base,
      presenze,
      costi: { ...costi, preAsiloRichiesto: true },
      rettaMesePrecedente: rettaSenzaAbbonamenti,
    });
    expect(soloPre).toEqual({ pre: { numero: 2, importo: 0 }, post: { numero: 2, importo: 16 } });
  });

  it('RET-13: con M-1 coperto e abbonamento attivo numero e importo sono 0 e 0', () => {
    const r = gettoniMesePrecedente({
      ...base,
      presenze: quattordici,
      costi: { ...costi, preAsiloRichiesto: true },
      rettaMesePrecedente: { costoPreAsilo: 70, costoPostAsilo: 0 },
    });
    expect(r.pre).toEqual({ numero: 0, importo: 0 });
  });

  it('RET-03: weekend e giorni di chiusura registrati non generano gettoni', () => {
    const presenze = [
      p('2026-09-05', true, true), // sabato
      p('2026-09-06', true, true), // domenica
      p('2026-09-08', true, true), // chiusura
      p('2026-09-09', true, true), // aperto
    ];
    const chiusure = [{ id: '1', dataInizio: '2026-09-08', dataFine: '2026-09-08', nota: 'Festa' }];
    expect(gettoniMesePrecedente({ ...base, presenze, chiusure })).toEqual({
      pre: { numero: 1, importo: 7 },
      post: { numero: 1, importo: 8 },
    });
  });

  it('RET-03: una chiusura di più giorni esclude tutti i giorni coperti', () => {
    const presenze = [p('2026-09-14', true, false), p('2026-09-15', true, false), p('2026-09-16', true, false)];
    const chiusure = [{ id: '1', dataInizio: '2026-09-14', dataFine: '2026-09-15', nota: null }];
    expect(gettoniMesePrecedente({ ...base, presenze, chiusure }).pre.numero).toBe(1);
  });

  it("RET-04: a gennaio si contano i giorni di dicembre dell'anno precedente", () => {
    const presenze = [
      p('2026-12-28', true, false),
      p('2026-12-29', true, true),
      p('2027-01-04', true, true), // gennaio stesso: non conta
    ];
    expect(gettoniMesePrecedente({ ...base, meseCorrente: '2027-01', presenze })).toEqual({
      pre: { numero: 2, importo: 14 },
      post: { numero: 1, importo: 8 },
    });
  });

  it('RET-04: a settembre (mese precedente agosto, senza apertura) i gettoni sono 0,00 e 0', () => {
    const chiusure = [{ id: '1', dataInizio: '2026-08-01', dataFine: '2026-08-31', nota: 'Estate' }];
    const presenze = [p('2026-08-03', true, true), p('2026-09-01', true, true)];
    expect(gettoniMesePrecedente({ ...base, meseCorrente: '2026-09', presenze, chiusure })).toEqual({
      pre: { numero: 0, importo: 0 },
      post: { numero: 0, importo: 0 },
    });
  });

  it('le presenze di altri mesi (anche due mesi prima) non contano', () => {
    const presenze = [p('2026-08-31', true, true), p('2026-10-01', true, true), p('2026-09-30', true, false)];
    expect(gettoniMesePrecedente({ ...base, presenze })).toEqual({
      pre: { numero: 1, importo: 7 },
      post: { numero: 0, importo: 0 },
    });
  });

  it('senza riga costi (bambino non comunicabile) i gettoni sono 0 e 0', () => {
    const presenze = [p('2026-09-01', true, true)];
    expect(gettoniMesePrecedente({ ...base, presenze, costi: null })).toEqual({
      pre: { numero: 0, importo: 0 },
      post: { numero: 0, importo: 0 },
    });
  });

  it('gettone a prezzo zero: i giorni si contano, importo 0', () => {
    const presenze = [p('2026-09-01', true, false)];
    const r = gettoniMesePrecedente({ ...base, presenze, costi: { ...costi, gettonePreAsilo: 0 } });
    expect(r.pre).toEqual({ numero: 1, importo: 0 });
  });
});

describe('calcolaRiepilogoRetta con i gettoni', () => {
  const parametri = {
    prezzoMensile: 100,
    prezzoBuonoPasto: 0,
    giorniAperturaMeseCorrente: 20,
    pastiPotenzialiMesePrecedente: 0,
    pastiEffettiviMesePrecedente: 0,
    marcaDaBollo: 2,
    preAsiloRichiesto: false,
    prezzoPreAsilo: 70,
    postAsiloRichiesto: false,
    prezzoPostAsilo: 70,
    costiExtra: 0,
    creditoDebito: 0,
    gettoniPreAsilo: 21,
    gettoniPostAsilo: 16,
  };

  it('RET-05: il totale è la somma delle voci già previste più 37,00 € di gettoni', () => {
    const senza = calcolaRiepilogoRetta({ ...parametri, gettoniPreAsilo: 0, gettoniPostAsilo: 0 });
    const con = calcolaRiepilogoRetta(parametri);
    expect(senza.totale).toBe(102);
    expect(con.totale).toBe(139);
    expect(con.gettoniPreAsilo).toBe(21);
    expect(con.gettoniPostAsilo).toBe(16);
  });

  it('RET-05: il totale somma i gettoni con le altre voci (abbonamento, extra, credito)', () => {
    const r = calcolaRiepilogoRetta({ ...parametri, preAsiloRichiesto: true, costiExtra: 15, creditoDebito: -5 });
    // 100 + 0 + 0 + 2 + 70 + 0 + 21 + 16 + 15 - 5
    expect(r.totale).toBe(219);
  });
});

// --- Conferma del mese e mese di competenza (specs/19, MOR-01..MOR-10) ------
//
// API attesa in lib/monteOreMensile.ts (pure, nessun I/O):
//   meseDiCompetenza({ created_at, mese_competenza? }): string  // 'AAAA-MM'
//   calcoloMensileMonteOre: i movimenti accettano anche `mese_competenza`
//     ('AAAA-MM-01' | null | assente) e contano nel mese di competenza.
//   parteNonConfermata({ differenza, movimenti }): number
//   puoConfermareMese({ mese, differenza, movimenti }, meseCorrente): boolean
//   nuovaVariazioneConferma(variazioneEsistente: number|string|null, parte): number
//   notaConfermaMese(mese: 'AAAA-MM', parte: number): string

describe('MOR-09: meseDiCompetenza', () => {
  it('usa il mese di competenza quando e\' valorizzato (data AAAA-MM-01)', () => {
    expect(meseDiCompetenza({ created_at: '2026-11-02T10:00:00Z', mese_competenza: '2026-10-01' })).toBe('2026-10');
  });

  it('senza competenza vale il mese della data di registrazione, nel fuso Europe/Rome', () => {
    expect(meseDiCompetenza({ created_at: '2026-09-15T10:00:00Z' })).toBe('2026-09');
    expect(meseDiCompetenza({ created_at: '2026-09-15T10:00:00Z', mese_competenza: null })).toBe('2026-09');
    // 30 set 22:30 UTC = 1 ott 00:30 a Roma.
    expect(meseDiCompetenza({ created_at: '2026-09-30T22:30:00Z', mese_competenza: null })).toBe('2026-10');
  });
});

describe('MOR-02, MOR-08, MOR-09: calcoloMensileMonteOre con mese di competenza', () => {
  const mesi = [
    { mese: '2026-10', orePreviste: 150, differenza: 14.5 },
    { mese: '2026-11', orePreviste: 20, differenza: 0 },
  ];

  it('un movimento registrato a novembre con competenza ottobre conta in ottobre', () => {
    const righe = calcoloMensileMonteOre({
      mesi,
      movimenti: [{ variazione: 14.5, created_at: '2026-11-02T10:00:00Z', mese_competenza: '2026-10-01' }],
      meseCorrente: '2026-11',
    });
    expect(righe).toEqual([
      { mese: '2026-10', orePreviste: 150, differenza: 14.5, movimenti: 14.5, saldo: 14.5 },
      { mese: '2026-11', orePreviste: 20, differenza: 0, movimenti: 0, saldo: 14.5 },
    ]);
  });

  it('i saldi a fine mese successivi sono cumulati per competenza', () => {
    const righe = calcoloMensileMonteOre({
      mesi,
      movimenti: [
        { variazione: 2, created_at: '2026-10-03T10:00:00Z', mese_competenza: '2026-10-01' },
        { variazione: 14.5, created_at: '2026-11-02T10:00:00Z', mese_competenza: '2026-10-01' },
        { variazione: -1, created_at: '2026-11-03T10:00:00Z', mese_competenza: '2026-11-01' },
      ],
      meseCorrente: '2026-11',
    });
    expect(righe.map((r) => [r.mese, r.movimenti, r.saldo])).toEqual([
      ['2026-10', 16.5, 16.5],
      ['2026-11', -1, 15.5],
    ]);
  });

  it('movimenti senza competenza valgono il mese di registrazione: calcolo identico a prima', () => {
    const conCompetenzaVuota = calcoloMensileMonteOre({
      mesi,
      movimenti: [
        { variazione: 3, created_at: '2026-10-03T10:00:00Z', mese_competenza: null },
        { variazione: 1, created_at: '2026-11-02T10:00:00Z' },
      ],
      meseCorrente: '2026-11',
    });
    const senzaCampo = calcoloMensileMonteOre({
      mesi,
      movimenti: [
        { variazione: 3, created_at: '2026-10-03T10:00:00Z' },
        { variazione: 1, created_at: '2026-11-02T10:00:00Z' },
      ],
      meseCorrente: '2026-11',
    });
    expect(conCompetenzaVuota).toEqual(senzaCampo);
    expect(conCompetenzaVuota.map((r) => r.movimenti)).toEqual([3, 1]);
  });

  it('un movimento con competenza in un mese senza ore crea comunque la riga di quel mese', () => {
    const righe = calcoloMensileMonteOre({
      mesi: [{ mese: '2026-11', orePreviste: 20, differenza: 0 }],
      movimenti: [{ variazione: 4, created_at: '2026-11-02T10:00:00Z', mese_competenza: '2026-09-01' }],
      meseCorrente: '2026-11',
    });
    expect(righe.map((r) => r.mese)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(righe[0]).toMatchObject({ movimenti: 4, saldo: 4 });
  });
});

describe('MOR-01, MOR-07: parteNonConfermata', () => {
  it('senza movimenti di competenza e\' tutta la differenza', () => {
    expect(parteNonConfermata({ differenza: 14.5, movimenti: 0 })).toBe(14.5);
    expect(parteNonConfermata({ differenza: -6, movimenti: 0 })).toBe(-6);
  });

  it('differenza meno la somma dei movimenti di competenza di qualunque tipo', () => {
    // Confermato +14,5 poi la differenza sale a +16,5: restano +2h.
    expect(parteNonConfermata({ differenza: 16.5, movimenti: 14.5 })).toBe(2);
    // La differenza scende a +12: -2,5h non confermate.
    expect(parteNonConfermata({ differenza: 12, movimenti: 14.5 })).toBe(-2.5);
  });

  it('MOR-08: un movimento manuale con competenza quel mese copre la differenza', () => {
    expect(parteNonConfermata({ differenza: 14.5, movimenti: 14.5 })).toBe(0);
  });

  it('arrotonda a 2 decimali e non restituisce mai -0', () => {
    expect(parteNonConfermata({ differenza: 0.3, movimenti: 0.1 + 0.2 })).toBe(0);
    expect(Object.is(parteNonConfermata({ differenza: 0, movimenti: 0 }), 0)).toBe(true);
    expect(parteNonConfermata({ differenza: 0.3, movimenti: 0.1 })).toBe(0.2);
  });
});

describe('MOR-01, MOR-04: puoConfermareMese', () => {
  const riga = { mese: '2026-10', differenza: 14.5, movimenti: 0 };

  it('mese chiuso con parte non confermata diversa da zero: si', () => {
    expect(puoConfermareMese(riga, '2026-11')).toBe(true);
    expect(puoConfermareMese({ ...riga, differenza: -6 }, '2026-11')).toBe(true);
    expect(puoConfermareMese({ ...riga, differenza: 16.5, movimenti: 14.5 }, '2026-11')).toBe(true);
  });

  it('mese in corso o futuro: no', () => {
    expect(puoConfermareMese(riga, '2026-10')).toBe(false);
    expect(puoConfermareMese(riga, '2026-09')).toBe(false);
  });

  it('parte non confermata zero (differenza zero o gia\' coperta): no', () => {
    expect(puoConfermareMese({ ...riga, differenza: 0 }, '2026-11')).toBe(false);
    expect(puoConfermareMese({ ...riga, movimenti: 14.5 }, '2026-11')).toBe(false);
  });
});

describe('MOR-06, MOR-07: nuovaVariazioneConferma', () => {
  it('senza conferma esistente la variazione e\' la parte non confermata', () => {
    expect(nuovaVariazioneConferma(null, 14.5)).toBe(14.5);
    expect(nuovaVariazioneConferma(null, -6)).toBe(-6);
  });

  it('con conferma esistente la parte si somma alla sua variazione (una sola conferma per mese)', () => {
    expect(nuovaVariazioneConferma(14.5, 2)).toBe(16.5);
    expect(nuovaVariazioneConferma('14.50', -2.5)).toBe(12);
    expect(nuovaVariazioneConferma(0.1, 0.2)).toBe(0.3);
  });
});

describe('MOR-02, MOR-03: notaConfermaMese', () => {
  it('nota automatica non vuota con mese e anno', () => {
    expect(notaConfermaMese('2026-10', 14.5)).toMatch(/^Conferma differenza ore di ottobre 2026/);
  });

  it('per una parte negativa dice "da recuperare", non solo il segno', () => {
    expect(notaConfermaMese('2026-09', -6)).toContain('settembre 2026');
    expect(notaConfermaMese('2026-09', -6)).toContain('da recuperare');
  });
});

// MOR-06 (doppio click / due admin) e il rifiuto di un non admin o di un mese
// non chiuso (MOR-04, lato server) non si provano in e2e: indice unico
// parziale e RLS sono in supabase/tests/database/monte_ore_conferma_mese.test.sql;
// "il valore lo calcola il server una volta sola" e' nelle funzioni pure qui sopra.
