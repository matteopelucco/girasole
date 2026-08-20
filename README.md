# Girasole — Registro Elettronico Asilo Sartorio

App per la gestione quotidiana di presenze, pasti e comunicazioni
dell'asilo, con viste dedicate per staff (admin/maestre) e genitori.

## Stack
Next.js 14 · TypeScript · Tailwind · Supabase (Postgres + Auth + RLS) · Vercel

## Setup locale
1. `npm install`
2. Copia `.env.example` in `.env.local` e compilalo con le chiavi del tuo
   progetto Supabase (Project Settings → API).
3. Applica lo schema: apri il SQL Editor di Supabase, incolla ed esegui in
   ordine i file di `supabase/migrations/` (`0001_init.sql`, poi
   `0002_admin_e_maestre.sql`).
4. `npm run dev` e apri http://localhost:3000

Vedi `specs/` per i requisiti di questa fase (un file per scenario) e
`TASKS.md` per lo stato di avanzamento. `CLAUDE.md` contiene il contesto
per lo sviluppo con Claude Code.

## Contribuire
Repo pubblico, pull request benvenute.

1. Fork o branch dal repo, un branch per feature/fix.
2. Apri una PR: Vercel genera automaticamente un deploy di anteprima da
   controllare prima del merge.
3. Nessun dato reale (bambini, genitori, famiglie) nei commit o negli
   esempi — solo dati fittizi.
4. Le PR vengono revisionate prima del merge su `main`, che è collegato al
   deploy di produzione.

Licenza: [MIT](LICENSE).
