import { describe, expect, it } from 'vitest';
import { controllaUi, trovaClassiRipetute, type EccezioneUi } from './controlloUi';

const file = (percorso: string, contenuto: string) => ({ percorso, contenuto });

describe('trovaClassiRipetute', () => {
  it('segnala un pulsante a tinta piena con padding, con file e riga', () => {
    const codice = [
      'export function A() {',
      '  return (',
      '    <button className="rounded-lg bg-emerald-700 px-4 py-2 text-white">Ok</button>',
      '  );',
      '}',
    ].join('\n');
    expect(trovaClassiRipetute([file('components/A.tsx', codice)])).toEqual([
      { file: 'components/A.tsx', riga: 3, tipo: 'pulsante' },
    ]);
  });

  it('segnala un pulsante secondario (bordo grigio e sfondo bianco con padding)', () => {
    const codice = `const c = 'rounded border border-stone-300 bg-white px-3 py-1.5 text-sm';`;
    expect(trovaClassiRipetute([file('app/x/a.tsx', codice)])).toEqual([
      { file: 'app/x/a.tsx', riga: 1, tipo: 'pulsante' },
    ]);
  });

  it('segnala un campo con bordo grigio e bordo scuro al focus', () => {
    const codice = '<input className="w-full rounded-lg border border-stone-300 px-3 py-2 outline-hidden focus:border-stone-500" />';
    expect(trovaClassiRipetute([file('components/B.tsx', codice)])).toEqual([
      { file: 'components/B.tsx', riga: 1, tipo: 'campo' },
    ]);
  });

  it('segnala una stringa su più righe (template literal) alla riga in cui inizia', () => {
    const codice = ['const a = 1;', 'const c = `', '  bg-red-600 px-3', '  py-1.5 text-white`;'].join('\n');
    expect(trovaClassiRipetute([file('components/C.tsx', codice)])).toEqual([
      { file: 'components/C.tsx', riga: 2, tipo: 'pulsante' },
    ]);
  });

  it('non segnala riquadri, etichette e badge senza il padding del pulsante', () => {
    const codice = [
      '<p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">a</p>',
      '<span className="rounded-full bg-red-600 px-1 text-xs text-white">1</span>',
      '<div className="border-t border-stone-300 bg-stone-50 p-4">b</div>',
      '<div className="bg-stone-900/40 fixed inset-0" />',
    ].join('\n');
    expect(trovaClassiRipetute([file('components/D.tsx', codice)])).toEqual([]);
  });

  it('non segnala i colori usati solo come classi di stato o con prefisso', () => {
    const codice = '<a className="px-3 py-2 hover:bg-stone-800 sm:bg-red-700 text-stone-600">x</a>';
    expect(trovaClassiRipetute([file('components/E.tsx', codice)])).toEqual([]);
  });

  it('ignora commenti e testo senza virgolette', () => {
    const codice = [
      '// bg-emerald-700 px-4 py-2',
      '/* border-stone-300 focus:border-stone-500 */',
      "<p>l'utente non può</p>",
    ].join('\n');
    expect(trovaClassiRipetute([file('components/F.tsx', codice)])).toEqual([]);
  });

  it('ignora components/ui/ (qui le classi sono a casa) e i file di test', () => {
    const codice = '<button className="bg-emerald-700 px-4 py-2" />';
    expect(
      trovaClassiRipetute([
        file('components/ui/pulsante.tsx', codice),
        file('components/G.test.tsx', codice),
        file(String.raw`./components\ui\altro.tsx`, codice),
      ]),
    ).toEqual([]);
  });
});

describe('controllaUi', () => {
  const codice = '<button className="bg-amber-700 px-3 py-2 text-white" />';
  const eccezione: EccezioneUi = { percorso: 'components/H.tsx', motivo: 'ancora da migrare' };

  it('riporta le violazioni dei file non in elenco', () => {
    const esito = controllaUi([file('components/H.tsx', codice)], []);
    expect(esito.violazioni).toHaveLength(1);
    expect(esito.eccezioniObsolete).toEqual([]);
  });

  it('non segnala un file presente nell\'elenco delle eccezioni', () => {
    const esito = controllaUi([file('components/H.tsx', codice)], [eccezione]);
    expect(esito).toEqual({ violazioni: [], eccezioniObsolete: [] });
  });

  it('segnala un\'eccezione che non serve più, così l\'elenco non marcisce', () => {
    const esito = controllaUi([file('components/H.tsx', '<p>niente classi</p>')], [eccezione]);
    expect(esito.violazioni).toEqual([]);
    expect(esito.eccezioniObsolete).toEqual([eccezione]);
  });

  it('ordina le violazioni per file e riga', () => {
    const esito = controllaUi(
      [file('components/Z.tsx', codice), file('app/a.tsx', `${codice}\n${codice}`)],
      [],
    );
    expect(esito.violazioni.map((v) => `${v.file}:${v.riga}`)).toEqual(['app/a.tsx:1', 'app/a.tsx:2', 'components/Z.tsx:1']);
  });
});
