// Logica pura della sezione "Variabili d'ambiente" (specs/62 -
// parametri-di-funzionamento.md, issue #287): filtro sulla lista dei
// parametri visibili (lib/parametriVisibili.ts), ordinamento e segnaposto.
// Nessun I/O: l'ambiente arriva come parametro (in produzione process.env).
//
// Si leggono SOLO le chiavi della lista, una per una: l'ambiente non viene
// mai elencato né copiato per intero.

export type Ambiente = Readonly<Record<string, string | undefined>>;

export type Parametro = { nome: string; valore: string };

// Segnaposto fisso al posto di ogni valore: uguale per tutti, così non lascia
// capire nemmeno la lunghezza del valore vero.
export const SEGNAPOSTO_VALORE = '••••••••';

const NOME_VALIDO = /^[A-Z][A-Z0-9_]*$/;

function nomiValidiOrdinati(lista: readonly string[]): string[] {
  return [...new Set(lista.filter((nome) => NOME_VALIDO.test(nome)))].sort();
}

// I nomi della lista configurati nell'ambiente, in ordine alfabetico: è
// l'unica cosa che la pagina manda al browser prima della verifica.
export function nomiParametriPresenti(lista: readonly string[], env: Ambiente): string[] {
  return nomiValidiOrdinati(lista).filter((nome) => env[nome] !== undefined);
}

// Nome e valore dei parametri della lista configurati nell'ambiente, in
// ordine alfabetico: solo per la Server Action, dopo la verifica.
export function valoriParametriPresenti(lista: readonly string[], env: Ambiente): Parametro[] {
  const out: Parametro[] = [];
  for (const nome of nomiValidiOrdinati(lista)) {
    const valore = env[nome];
    if (valore !== undefined) out.push({ nome, valore });
  }
  return out;
}
