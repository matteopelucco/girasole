-- Girasole — Requisito 04 (specs/04 - data-types.md): un alunno è
-- univoco per Nome + Cognome + Data di nascita (senza distinguere
-- maiuscole/minuscole) — evita di inserire lo stesso bambino due volte.
--
-- bambini.data_nascita resta nullable per compatibilità con le righe
-- inserite prima di 0006_data_types.sql: più bambini senza data di
-- nascita non sono considerati duplicati tra loro (comportamento
-- standard di Postgres per gli indici unici su colonne NULL) — il form
-- admin la richiede comunque per i nuovi inserimenti.
--
-- Se l'esecuzione fallisce per un vincolo violato, significa che sul
-- progetto esistono già duplicati: vanno ripuliti a mano prima di
-- riprovare (questa migration non tocca né cancella righe esistenti).
--
-- Incolla questo file nel SQL Editor di Supabase (dopo 0009) ed
-- eseguilo una volta sola.
create unique index if not exists bambini_univoco_nome_cognome_nascita
  on public.bambini (lower(nome), lower(cognome), data_nascita);
