import { describe, expect, it } from 'vitest';
import { trovaClickSalvaNonAttesi } from './e2e-salvataggio';

function test(corpo: string, titolo = 'fa qualcosa'): string {
  return `test('${titolo}', async ({ page }) => {\n${corpo}\n});\n`;
}

describe('trovaClickSalvaNonAttesi', () => {
  it('segnala un click su "Salva..." non atteso seguito da reload, con la riga del click', () => {
    const codice = test(
      [
        "  await page.getByLabel('Nome').fill('x');",
        "  await page.getByRole('button', { name: 'Salva modifiche' }).click();",
        '  await page.reload();',
      ].join('\n')
    );
    expect(trovaClickSalvaNonAttesi(codice)).toEqual([{ riga: 3, rigaRicaricamento: 4 }]);
  });

  it('segnala anche goto, Registra e Aggiorna', () => {
    const codice = [
      test("  await riga.getByRole('button', { name: 'Aggiorna' }).click();\n  await page.goto('/x');", 'a'),
      test("  await page.getByRole('button', { name: 'Registra presenza' }).click();\n  await page.goto('/x');", 'b'),
    ].join('\n');
    expect(trovaClickSalvaNonAttesi(codice)).toHaveLength(2);
  });

  it('segnala il nome dato come regex che inizia con il verbo', () => {
    const codice = test(
      "  await page.getByRole('button', { name: /^Salva/ }).click();\n  await page.reload();"
    );
    expect(trovaClickSalvaNonAttesi(codice)).toHaveLength(1);
  });

  it('segnala un click scritto su più righe', () => {
    const codice = test(
      [
        '  await page',
        "    .getByRole('button', { name: 'Salva costi' })",
        '    .click();',
        '  await page.reload();',
      ].join('\n')
    );
    expect(trovaClickSalvaNonAttesi(codice)).toEqual([{ riga: 4, rigaRicaricamento: 5 }]);
  });

  it('non segnala il click fatto con clickEAttendiAzione', () => {
    const codice = test(
      [
        "  await clickEAttendiAzione(page, page.getByRole('button', { name: 'Salva modifiche' }));",
        '  await page.reload();',
      ].join('\n')
    );
    expect(trovaClickSalvaNonAttesi(codice)).toEqual([]);
  });

  it('non segnala il click atteso con waitForResponse nella stessa istruzione', () => {
    const codice = test(
      [
        '  await Promise.all([',
        '    page.waitForResponse((r) => r.request().method() === "POST"),',
        "    page.getByRole('button', { name: 'Salva' }).click(),",
        '  ]);',
        '  await page.reload();',
      ].join('\n')
    );
    expect(trovaClickSalvaNonAttesi(codice)).toEqual([]);
  });

  it("non segnala il click se prima del reload c'è un'asserzione positiva sull'esito", () => {
    const codice = test(
      [
        "  await page.getByRole('button', { name: 'Salva modifiche' }).click();",
        "  await expect(alertApp(page)).toContainText('motivo');",
        '  await page.reload();',
      ].join('\n')
    );
    expect(trovaClickSalvaNonAttesi(codice)).toEqual([]);
  });

  it("non segnala il click se prima del reload c'è un'attesa esplicita della rete o un altro click atteso", () => {
    const codice = [
      test(
        [
          "  await page.getByRole('button', { name: 'Salva' }).click();",
          "  await page.waitForResponse('**/api/x');",
          '  await page.reload();',
        ].join('\n'),
        'a'
      ),
      test(
        [
          "  await page.getByRole('button', { name: 'Salva' }).click();",
          "  await clickEAttendiAzione(page, page.getByRole('button', { name: 'Altro' }));",
          '  await page.goto("/x");',
        ].join('\n'),
        'b'
      ),
    ].join('\n');
    expect(trovaClickSalvaNonAttesi(codice)).toEqual([]);
  });

  it('segnala il click se prima del reload ci sono solo asserzioni che passano subito (toHaveCount(0), not)', () => {
    const codice = test(
      [
        "  await page.getByRole('button', { name: 'Salva' }).click();",
        '  await expect(alertApp(page)).toHaveCount(0);',
        "  await expect(page.getByText('Errore')).not.toBeVisible();",
        '  await page.waitForTimeout(1000);',
        '  await page.reload();',
      ].join('\n')
    );
    expect(trovaClickSalvaNonAttesi(codice)).toHaveLength(1);
  });

  it('ignora i click su bottoni che non sono di salvataggio', () => {
    const codice = test(
      [
        "  await page.getByRole('button', { name: 'Aggiungi bambino' }).click();",
        "  await page.getByRole('button', { name: 'Elimina utente' }).click();",
        "  await page.getByRole('button', { name: 'Accedi' }).click();",
        '  await page.reload();',
      ].join('\n')
    );
    expect(trovaClickSalvaNonAttesi(codice)).toEqual([]);
  });

  it('ignora i click su elementi che non sono bottoni (link, testo)', () => {
    const codice = test(
      "  await page.getByRole('link', { name: 'Salva' }).click();\n  await page.reload();"
    );
    expect(trovaClickSalvaNonAttesi(codice)).toEqual([]);
  });

  it('non segnala un click non atteso se nel test non c\'è nessun reload/goto dopo', () => {
    const codice = test(
      [
        '  await page.goto("/x");',
        "  await page.getByRole('button', { name: 'Salva modifiche' }).click();",
        "  await expect(page.getByText('Salvato')).toBeVisible();",
      ].join('\n')
    );
    expect(trovaClickSalvaNonAttesi(codice)).toEqual([]);
  });

  it('non considera un reload/goto che appartiene a un altro test', () => {
    const codice = [
      test("  await page.getByRole('button', { name: 'Salva' }).click();", 'primo'),
      test("  await page.goto('/x');", 'secondo'),
    ].join('\n');
    expect(trovaClickSalvaNonAttesi(codice)).toEqual([]);
  });

  it('non considera un reload/goto che appartiene a un altro test dentro un describe', () => {
    const codice = [
      "test.describe('gruppo', () => {",
      "  test('primo', async ({ page }) => {",
      "    await page.getByRole('button', { name: 'Salva' }).click();",
      '  });',
      "  test.afterEach(async ({ page }) => {",
      "    await page.goto('/x');",
      '  });',
      '});',
    ].join('\n');
    expect(trovaClickSalvaNonAttesi(codice)).toEqual([]);
  });

  it('un test.skip(condizione, motivo) dentro il test non apre un nuovo test', () => {
    const codice = test(
      [
        "  await page.getByRole('button', { name: 'Salva' }).click();",
        "  test.skip(!hasCredenziali('admin'), 'senza credenziali');",
        '  await page.reload();',
      ].join('\n')
    );
    expect(trovaClickSalvaNonAttesi(codice)).toHaveLength(1);
  });

  it('ignora i commenti (riga e blocco)', () => {
    const codice = test(
      [
        "  // await page.getByRole('button', { name: 'Salva' }).click();",
        "  /* await page.getByRole('button', { name: 'Salva' }).click(); */",
        '  // poi page.reload() per rileggere',
        "  await expect(page.getByText('x')).toBeVisible();",
      ].join('\n')
    );
    expect(trovaClickSalvaNonAttesi(codice)).toEqual([]);
  });

  it('riporta più click non attesi dello stesso test, ciascuno con la sua riga', () => {
    const codice = test(
      [
        "  await page.getByRole('button', { name: 'Salva' }).click();",
        "  await page.getByRole('button', { name: 'Salva' }).click();",
        '  await page.reload();',
      ].join('\n')
    );
    expect(trovaClickSalvaNonAttesi(codice).map((c) => c.riga)).toEqual([2, 3]);
  });

  it('con codice vuoto non segnala nulla', () => {
    expect(trovaClickSalvaNonAttesi('')).toEqual([]);
  });
});
