import { describe, expect, it } from 'vitest';
import { estraiUsoClaude, formattaRiepilogoUso } from './claude-usage';

const risultato = {
  type: 'result',
  num_turns: 14,
  total_cost_usd: 0.31,
  usage: {
    input_tokens: 120,
    output_tokens: 4500,
    cache_read_input_tokens: 90000,
    cache_creation_input_tokens: 15000,
  },
};

describe('estraiUsoClaude', () => {
  it('legge il messaggio result da un array JSON', () => {
    const uso = estraiUsoClaude(JSON.stringify([{ type: 'system' }, risultato]));
    expect(uso).toEqual({
      inputTokens: 120,
      outputTokens: 4500,
      cacheReadTokens: 90000,
      cacheCreationTokens: 15000,
      turni: 14,
      costoUsd: 0.31,
    });
  });

  it('legge il formato una riga JSON per messaggio', () => {
    const uso = estraiUsoClaude(`${JSON.stringify({ type: 'system' })}\n${JSON.stringify(risultato)}\n`);
    expect(uso?.inputTokens).toBe(120);
  });

  it('tratta i campi mancanti come 0', () => {
    const uso = estraiUsoClaude(JSON.stringify([{ type: 'result', usage: { input_tokens: 5 } }]));
    expect(uso).toMatchObject({ inputTokens: 5, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 });
  });

  it('restituisce null se non c\'è un result o il JSON è invalido', () => {
    expect(estraiUsoClaude('non json')).toBeNull();
    expect(estraiUsoClaude(JSON.stringify([{ type: 'system' }]))).toBeNull();
    expect(estraiUsoClaude('')).toBeNull();
  });
});

describe('formattaRiepilogoUso', () => {
  it('produce una tabella markdown con totale contesto e percentuale di cache', () => {
    const uso = estraiUsoClaude(JSON.stringify([risultato]))!;
    const md = formattaRiepilogoUso('Review', uso);
    expect(md).toContain('Review');
    expect(md).toContain('| Token di input | 120 |');
    expect(md).toContain('| Token di output | 4500 |');
    expect(md).toContain('| Letti dalla cache | 90000 |');
    expect(md).toContain('| Scritti in cache | 15000 |');
    // 90000 / (120 + 90000 + 15000) = 85,6%
    expect(md).toContain('85,6%');
  });

  it('non divide per zero', () => {
    const md = formattaRiepilogoUso('Triage', {
      inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, turni: 0, costoUsd: 0,
    });
    expect(md).toContain('0,0%');
  });
});
