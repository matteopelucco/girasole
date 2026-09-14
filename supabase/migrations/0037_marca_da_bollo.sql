-- Girasole — Marca da bollo (specs/55, specs/56): nuova voce di costo
-- fissa mensile per bambino, come retta mensile e buono pasto (non un
-- servizio opzionale come pre/post-asilo). Di default 2€ (valore
-- corrente della marca da bollo amministrativa) sia per i bambini che
-- hanno già una riga in costi_bambini (il default dell'ALTER la
-- applica retroattivamente) sia per quelli creati da qui in poi.
--
-- comunicazioni_retta è un log immutabile: le comunicazioni già inviate
-- in passato non prevedevano questa voce, quindi il default lì è 0 (mai
-- riscritto sulle righe storiche), non 2 — i nuovi invii scrivono
-- sempre il valore calcolato esplicitamente.
--
-- Incolla questo file nel SQL Editor di Supabase (test e produzione),
-- dopo 0036_comunicazione_retta.sql, ed eseguilo una volta sola.

alter table public.costi_bambini
  add column prezzo_marca_da_bollo numeric(10, 2) not null default 2;

alter table public.comunicazioni_retta
  add column marca_da_bollo numeric(10, 2) not null default 0;
