-- Girasole — Stati "chiusura" e "ferie" per un giorno del report ore di
-- lavoro (specs/18 - report-ore-lavoro.md, issue #143): giorni "di
-- vacanza", senza ore né campi da compilare, esclusi dal calcolo di ore
-- dovute, differenza e monte ore.
--
-- Allarga solo il vincolo sullo stato: nessuna nuova tabella né policy
-- (la RLS di ore_lavoro_giorni resta quella di 0025, che non dipende
-- dallo stato).

alter table public.ore_lavoro_giorni
  drop constraint if exists ore_lavoro_giorni_stato_check;

alter table public.ore_lavoro_giorni
  add constraint ore_lavoro_giorni_stato_check
  check (stato in ('lavorativo', 'malattia', 'assenza', 'chiusura', 'ferie'));
