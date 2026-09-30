-- Girasole — Convenzione unica del segno del monte ore (specs/19 - monte-ore.md,
-- issue #158): da ora
--   positivo (+) = ore che il dipendente HA GIÀ erogato in più (a credito),
--   negativo (-) = ore che il dipendente DEVE ANCORA erogare (da recuperare).
-- Prima era l'opposto (positivo = "il monte ore aumenta", cioè debito).
--
-- Questa migration inverte il segno di TUTTI i movimenti già registrati
-- (variazione = -variazione). Nessun cambio di schema né di RLS.
--
-- ATTENZIONE: inverte dati. Il marcatore nel commento della colonna la rende
-- sicura se rieseguita per errore (la seconda volta non fa nulla), ma va
-- comunque applicata UNA SOLA VOLTA, subito dopo il deploy del codice che usa
-- la nuova convenzione: fino ad allora la UI mostrerebbe i saldi invertiti.
-- Dopo: `select utente_id, sum(variazione) from public.monte_ore_movimenti
-- group by utente_id` deve dare l'opposto dei saldi di prima.
--
-- Incolla questo file nel SQL Editor di Supabase (test e produzione), dopo
-- 0055_monte_ore_manuale.sql. In test/dev la applica il reset di CI.

do $$
declare
  commento text;
begin
  select col_description('public.monte_ore_movimenti'::regclass, a.attnum)
    into commento
  from pg_attribute a
  where a.attrelid = 'public.monte_ore_movimenti'::regclass
    and a.attname = 'variazione';

  if coalesce(commento, '') like 'Convenzione v2%' then
    raise notice 'Segno del monte ore già invertito: nessuna modifica.';
  else
    update public.monte_ore_movimenti
      set variazione = -variazione
      where true;

    comment on column public.monte_ore_movimenti.variazione is
      'Convenzione v2: positivo (+) = ore a credito (già erogate in più), negativo (-) = ore da recuperare (ancora da erogare).';
  end if;
end $$;
