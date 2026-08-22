-- Girasole — fix: ricorsione RLS su ruolo_corrente()
--
-- Bug: ruolo_corrente() (supabase/migrations/0001_init.sql) legge
-- public.profili SENZA essere security definer. Ogni policy che la usa
-- (bambini, presenze, pasti, promemoria, sezioni, maestre_sezioni,
-- anni_scolastici, bambini_sezioni_storico, profili stessa) la richiama
-- per valutare "sono admin?": la lettura di profili dentro la funzione
-- riattiva la RLS di profili, la cui policy richiama di nuovo
-- ruolo_corrente() — su una riga che non è la propria (es. durante una
-- scansione dell'intera tabella, sempre più probabile man mano che
-- profili cresce) questo ricorsione non si ferma finché Postgres non
-- esaurisce lo stack ("stack depth limit exceeded", visto in produzione
-- creando un promemoria) — e anche quando non arriva a quel punto,
-- appesantisce inutilmente ogni pagina che legge il profilo dell'utente
-- (praticamente tutte).
--
-- Fix: come handle_new_user() e puo_richiedere_reset_password() (già
-- security definer nelle migration precedenti), rendere ruolo_corrente()
-- security definer — la sua lettura di profili così bypassa la RLS
-- invece di riattivarla, spezzando la ricorsione. Nessun rischio di
-- fuga di privilegi: la funzione resta di sola lettura, ristretta alla
-- singola riga di auth.uid(), e il suo output (il ruolo) è già quello
-- che le policy leggono comunque.
--
-- Incolla questo file nel SQL Editor di Supabase (dopo
-- 0006_data_types.sql) ed eseguilo una volta sola.

create or replace function public.ruolo_corrente()
returns ruolo_utente
language sql stable security definer
set search_path = public
as $$
  select ruolo from public.profili where id = auth.uid();
$$;
