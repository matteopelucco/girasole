// Versione mostrata in fondo alle pagine (vedi app/layout.tsx). Da
// aggiornare manualmente ad ogni rilascio finché non c'è un processo di
// build automatizzato che le valorizzi da sé. DATA_BUILD include anche
// ora, minuti e secondi (fuso Europe/Rome, non UTC — coerente con
// lib/date.ts), non solo la data: utile per distinguere più rilasci
// fatti nello stesso giorno.
export const VERSIONE_APP = '0.12.1';
export const DATA_BUILD = '2026-08-29 19:32:43';
