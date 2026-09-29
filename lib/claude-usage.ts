// Girasole — logica pura per leggere token e cache di un'esecuzione
// claude-code-action (issue #119). Nessun I/O: il file
// `claude-execution-output.json` lo legge scripts/riepilogo-token-claude.mts.

export interface UsoClaude {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  turni: number;
  costoUsd: number;
}

function numero(valore: unknown): number {
  return typeof valore === 'number' && Number.isFinite(valore) ? valore : 0;
}

// Il file è un array JSON di messaggi; per sicurezza accetta anche una
// riga JSON per messaggio.
function leggiMessaggi(testo: string): unknown[] | null {
  try {
    const dati: unknown = JSON.parse(testo);
    return Array.isArray(dati) ? dati : [dati];
  } catch {
    const messaggi: unknown[] = [];
    for (const riga of testo.split('\n')) {
      if (!riga.trim()) continue;
      try {
        messaggi.push(JSON.parse(riga));
      } catch {
        return null;
      }
    }
    return messaggi.length > 0 ? messaggi : null;
  }
}

export function estraiUsoClaude(testo: string): UsoClaude | null {
  const messaggi = leggiMessaggi(testo);
  if (!messaggi) return null;
  const risultato = [...messaggi]
    .reverse()
    .find((m): m is Record<string, unknown> => typeof m === 'object' && m !== null && (m as { type?: unknown }).type === 'result');
  if (!risultato) return null;
  const usage = (risultato.usage ?? {}) as Record<string, unknown>;
  return {
    inputTokens: numero(usage.input_tokens),
    outputTokens: numero(usage.output_tokens),
    cacheReadTokens: numero(usage.cache_read_input_tokens),
    cacheCreationTokens: numero(usage.cache_creation_input_tokens),
    turni: numero(risultato.num_turns),
    costoUsd: numero(risultato.total_cost_usd),
  };
}

export function formattaRiepilogoUso(titolo: string, uso: UsoClaude): string {
  const contesto = uso.inputTokens + uso.cacheReadTokens + uso.cacheCreationTokens;
  const percentuale = contesto > 0 ? ((uso.cacheReadTokens / contesto) * 100).toFixed(1).replace('.', ',') : '0,0';
  return [
    `### Token Claude — ${titolo}`,
    '',
    '| Voce | Valore |',
    '| --- | --- |',
    `| Token di input | ${uso.inputTokens} |`,
    `| Token di output | ${uso.outputTokens} |`,
    `| Letti dalla cache | ${uso.cacheReadTokens} |`,
    `| Scritti in cache | ${uso.cacheCreationTokens} |`,
    `| Contesto totale (input + cache) | ${contesto} |`,
    `| Quota letta dalla cache | ${percentuale}% |`,
    `| Turni | ${uso.turni} |`,
    `| Costo (USD) | ${uso.costoUsd} |`,
    '',
  ].join('\n');
}
