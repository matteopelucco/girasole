-- Girasole — Valori predefiniti di buono pasto e pre/post-asilo
-- (specs/55): buono pasto 6€, pre-asilo e post-asilo 70€ ciascuno —
-- gli importi correnti tipici, per non far partire un bambino nuovo da
-- 0 quando questi servizi quasi sempre costano quella cifra.
--
-- SOLO il default per i FUTURI insert cambia: nessun backfill delle
-- righe già esistenti in costi_bambini. A differenza della marca da
-- bollo (0037, un campo nuovo dove backfillare a 2 era inequivocabile:
-- nessun valore precedente poteva esistere), questi tre prezzi sono già
-- in uso da tempo con importi reali inseriti dall'admin per bambini
-- veri — riscrivere in massa chi ha oggi 0 rischierebbe di confondere
-- "non ancora configurato" con "configurato deliberatamente a zero" e
-- di alterare dati economici reali senza che nessuno l'abbia chiesto.
-- Il default nuovo si vede solo compilando i costi di un bambino che
-- non ne ha ancora (`app/admin/bambini/[id]/page.tsx`, già così anche
-- per la marca da bollo).
--
-- Incolla questo file nel SQL Editor di Supabase (test e produzione),
-- dopo la 0038, ed eseguilo una volta sola.

alter table public.costi_bambini alter column prezzo_buono_pasto set default 6;
alter table public.costi_bambini alter column prezzo_pre_asilo set default 70;
alter table public.costi_bambini alter column prezzo_post_asilo set default 70;
