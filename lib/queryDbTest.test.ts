import { describe, expect, it } from 'vitest';
import { sqlRigheJson, urlDbLocaleValido } from './queryDbTest';

describe('urlDbLocaleValido', () => {
  it('accetta solo un database su questo computer', () => {
    expect(urlDbLocaleValido('postgresql://127.0.0.1:54322/postgres')).toBe(true);
    expect(urlDbLocaleValido('postgres://localhost:54322/postgres')).toBe(true);
  });

  it('rifiuta qualunque database remoto', () => {
    expect(urlDbLocaleValido('postgresql://db.abcdefgh.supabase.co:5432/postgres')).toBe(false);
    expect(urlDbLocaleValido('postgresql://aws-0-eu.pooler.supabase.com:6543/postgres')).toBe(false);
    expect(urlDbLocaleValido('postgresql://127.0.0.1.esempio.it:5432/postgres')).toBe(false);
    expect(urlDbLocaleValido('postgresql://127.0.0.1:5432/postgres?host=db.esempio.it')).toBe(false);
    expect(urlDbLocaleValido('postgresql://127.0.0.1:5432/postgres?hostaddr=10.0.0.1')).toBe(false);
  });

  it('rifiuta valori non validi e altri protocolli', () => {
    expect(urlDbLocaleValido('')).toBe(false);
    expect(urlDbLocaleValido('non un indirizzo')).toBe(false);
    expect(urlDbLocaleValido('http://127.0.0.1:54321')).toBe(false);
  });
});

describe('sqlRigheJson', () => {
  it('avvolge la query perché restituisca un solo valore JSON, anche senza righe', () => {
    expect(sqlRigheJson('select 1 as a')).toBe(`select coalesce(json_agg(t), '[]'::json) from (select 1 as a) t`);
  });
});
