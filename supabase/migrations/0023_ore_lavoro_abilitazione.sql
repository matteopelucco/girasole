-- Girasole — Requisito 17 (specs/17 - ore-di-lavoro.md): abilitazione
-- per singolo utente alla sezione "Ore di lavoro" (personale retribuito
-- che in una fase successiva potrà segnare ore lavorate/assenze). Solo
-- l'abilitazione in questa fase: nessuna tabella per i dati veri e
-- propri, che sono fuori scope (vedi specs/17).
--
-- Nessuna nuova policy RLS: la colonna è coperta dalle policy già
-- esistenti su public.profili (profili_select_own_or_admin,
-- profili_select_colleghe, profili_update_admin — 0001_init.sql,
-- 0002_admin_e_maestre.sql, 0016_assistente_e_pre_post_asilo.sql), che
-- sono a livello di riga, non di colonna.
--
-- Incolla questo file nel SQL Editor di Supabase (dopo
-- 0022_calendario_scolastico.sql) ed eseguilo una volta sola.

alter table public.profili add column if not exists abilitato_ore_lavoro boolean not null default false;
