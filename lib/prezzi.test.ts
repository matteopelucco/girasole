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
} from './prezzi';

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
