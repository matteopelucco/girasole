# TASKS.md

## Fatto (scaffold iniziale)
- [x] Setup Next.js 14 + Tailwind + TypeScript
- [x] Client Supabase (browser + server) e middleware di sessione
- [x] Pagina di login con Server Action
- [x] Dashboard placeholder con ruolo utente
- [x] Schema SQL iniziale con RLS (profili, sezioni, bambini, presenze,
      pasti, promemoria)

## Da fare — Fase 1
- [ ] Pagina admin per creare sezioni e bambini (form semplice)
- [ ] Pagina admin per assegnare maestre a sezioni e promuovere un utente a
      maestra/admin
- [ ] Dashboard maestra: lista bambini della sezione con stato
      presenza/pasto del giorno
- [ ] Azione "segna presenza" (presente/assente/malattia + nota)
- [ ] Azione "segna pasto" (sì/no/parziale + nota), con evidenza allergie da
      `bambini.note_allergie`
- [ ] Creazione e lista promemoria (tutti / sezione / bambino)
- [ ] Seed di dati di prova (una sezione, 3-4 bambini) per testare in locale

## Backlog — Fase 2/3
- [ ] Rette mensili e stato pagamento
- [ ] Report mensile presenze per amministrazione
- [ ] Portale genitori (UI dedicata)
