-- Girasole — Movimento settimanale a netto pieno (estende specs/19 -
-- monte-ore.md): il movimento automatico "settimanale" ora rappresenta
-- ore dovute − ore ordinarie erogate − ore straordinarie erogate, che
-- può essere negativo (scala il monte ore quando si è lavorato più del
-- dovuto). Prima di questo cambio era sempre >= 0 (solo la carenza
-- residua, mai una compensazione automatica dello straordinario) — il
-- passaggio "straordinario residuo in attesa di decisione dell'admin"
-- non si genera più per le nuove conferme, ma resta possibile
-- risolvere quelle già pendenti da PRIMA di questo cambio (nessuna
-- colonna rimossa, solo il vincolo che segue).
--
-- Incolla questo file nel SQL Editor di Supabase (test e produzione),
-- dopo 0044_elimina_movimento_precarico.sql, ed eseguilo una volta
-- sola.

alter table public.monte_ore_movimenti
  drop constraint monte_ore_movimenti_settimanale_non_negativo;
