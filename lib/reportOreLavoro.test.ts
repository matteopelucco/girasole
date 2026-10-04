import { describe, expect, it } from 'vitest';
import { formattaRiepilogoOreLavoroHtml } from './reportOreLavoro';

// formattaRiepilogoOreLavoroHtml è la parte pura (nessun I/O) del
// riepilogo ore nel corpo dell'email notturna (specs/52): chi chiama ha
// già letto e aggregato i dati. Le query Supabase di
// generaRiepilogoOreLavoroSettimanaHtml sono coperte solo da e2e.
const RIGA = { nome: 'Anna', cognome: 'Bianchi', ordinarie: 8, straordinarie: 1, totale: 9, saldo: '+3h a credito' };

describe('formattaRiepilogoOreLavoroHtml', () => {
  it('per una persona normale genera titolo e riga con ore e monte ore', () => {
    const html = formattaRiepilogoOreLavoroHtml('Ore di lavoro — settimana 1-7 settembre', [RIGA]);
    expect(html).toContain('<h2>Ore di lavoro — settimana 1-7 settembre</h2>');
    expect(html).toContain('>Anna Bianchi</td>');
    expect(html).toContain('>8</td>');
    expect(html).toContain('>1</td>');
    expect(html).toContain('>9</td>');
    expect(html).toContain('>+3h a credito</td>');
  });

  it('senza personale abilitato mostra il messaggio dedicato', () => {
    const html = formattaRiepilogoOreLavoroHtml('Titolo', []);
    expect(html).toBe('<h2>Titolo</h2><p>Nessun membro del personale è abilitato al report ore.</p>');
  });

  it('rende come testo nome, cognome e titolo con markup, & e virgolette', () => {
    const html = formattaRiepilogoOreLavoroHtml('<script>t</script> & "titolo"', [
      { ...RIGA, nome: '<script>alert(1)</script>', cognome: 'Rossi & "Figli"' },
    ]);
    expect(html).not.toContain('<script>');
    expect(html).toContain('<h2>&lt;script&gt;t&lt;/script&gt; &amp; &quot;titolo&quot;</h2>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; Rossi &amp; &quot;Figli&quot;');
  });

  it("un apostrofo (D'Angelo) è escapato come &#39;, che l'HTML mostra come apostrofo", () => {
    const html = formattaRiepilogoOreLavoroHtml('Titolo', [{ ...RIGA, cognome: "D'Angelo" }]);
    expect(html).toContain('Anna D&#39;Angelo');
  });
});
