# TASKS.md

## Fatto (scaffold iniziale)
- [x] Setup Next.js 14 + Tailwind + TypeScript
- [x] Client Supabase (browser + server) e middleware di sessione
- [x] Pagina di login con Server Action
- [x] Dashboard placeholder con ruolo utente
- [x] Schema SQL iniziale con RLS (profili, sezioni, bambini, presenze,
      pasti, promemoria)

## Da fare — Fase 1
- [x] Pagina admin per creare sezioni e bambini (form semplice)
- [x] Pagina admin per assegnare maestre a sezioni e promuovere un utente a
      maestra/admin
- [x] Dashboard maestra: lista bambini della sezione con stato
      presenza/pasto del giorno
- [x] Azione "segna presenza" (presente/assente/malattia + nota)
- [x] Azione "segna pasto" (sì/no/parziale + nota), con evidenza allergie da
      `bambini.note_allergie`
- [x] Creazione e lista promemoria (tutti / sezione / bambino)
- [x] Seed di dati di prova (una sezione, 3-4 bambini) per testare in locale

Nota: applica `supabase/migrations/0002_admin_e_maestre.sql` (nuove policy
RLS + colonna `email` su `profili`) nel SQL Editor di Supabase prima di
usare le pagine admin — senza quella migration le maestre non riescono a
vedere i bambini della propria sezione (bug corretto nella stessa
migration: mancava la policy di select su `maestre_sezioni`).

## Backlog — Fase 2/3
- [ ] Rette mensili e stato pagamento
- [ ] Report mensile presenze per amministrazione
- [ ] Portale genitori (UI dedicata)
