-- Girasole — dati di prova per testare la dashboard in locale.
-- Solo dati fittizi: non incollare mai qui informazioni reali di bambini o famiglie.
-- Da eseguire a mano nel SQL Editor di Supabase (dopo le migration 0001 e 0002),
-- su un progetto di sviluppo/test — non in produzione.

insert into public.sezioni (id, nome)
values ('00000000-0000-0000-0000-000000000001', 'Girasoli')
on conflict (id) do nothing;

-- sesso (issue #106, specs/10): un bambino per caso — femmina, maschio,
-- non compilato (Marco) — per coprire i tre stili dell'intestazione
-- della card in e2e/10. Dati fittizi.
insert into public.bambini (id, nome, cognome, sezione_id, note_allergie, sesso)
values
  ('00000000-0000-0000-0000-000000000011', 'Anna', 'Rossi', '00000000-0000-0000-0000-000000000001', null, 'F'),
  ('00000000-0000-0000-0000-000000000012', 'Luca', 'Bianchi', '00000000-0000-0000-0000-000000000001', 'Allergia alle arachidi', 'M'),
  ('00000000-0000-0000-0000-000000000013', 'Sara', 'Verdi', '00000000-0000-0000-0000-000000000001', null, 'F'),
  ('00000000-0000-0000-0000-000000000014', 'Marco', 'Neri', '00000000-0000-0000-0000-000000000001', 'Intolleranza al lattosio', null)
on conflict (id) do nothing;

-- Per collegare una maestra a questa sezione (dopo aver registrato un
-- utente e averlo promosso a 'maestra' dalla pagina /admin/maestre):
--
-- insert into public.maestre_sezioni (maestra_id, sezione_id)
-- values ('<uuid-del-profilo-maestra>', '00000000-0000-0000-0000-000000000001')
-- on conflict do nothing;

-- Lanci di prova dei job pianificati (specs/63, e2e/63-cron-job.spec.ts):
-- date lontane e fisse (2019), mai lanci reali. 25 lanci del report notturno
-- (più di una pagina da 20, per "Carica altri") e 3 del riepilogo allarmi:
-- uno OK, uno KO con messaggio, uno senza esito (interrotto); più un lancio
-- a mano (estemporaneo), più sotto.
insert into public.cron_esecuzioni (id, nome, iniziato_il, finito_il, esito)
select
  ('00000000-0000-0000-0000-0000000063' || lpad(g::text, 2, '0'))::uuid,
  'report-presenze',
  timestamptz '2019-01-01 23:00:00+00' + (g - 1) * interval '1 day',
  timestamptz '2019-01-01 23:00:07+00' + (g - 1) * interval '1 day',
  'ok'
from generate_series(1, 25) as g
on conflict (id) do nothing;

insert into public.cron_esecuzioni (id, nome, iniziato_il, finito_il, esito, messaggio_errore)
values
  ('00000000-0000-0000-0000-000000006391', 'allarmi', '2019-02-01 09:30:00+00', '2019-02-01 09:30:04+00', 'ok', null),
  ('00000000-0000-0000-0000-000000006392', 'allarmi', '2019-02-02 09:30:00+00', null, null, null),
  ('00000000-0000-0000-0000-000000006393', 'allarmi', '2019-02-03 09:30:00+00', '2019-02-03 09:30:05+00', 'ko',
   'Invio email fallito (500): servizio non disponibile')
on conflict (id) do nothing;

-- Un lancio a mano dell'admin (issue #302, colonna `estemporaneo` della
-- migration 0064): stesso job, date fittizie del 2019, tag "estemporaneo"
-- nella pagina.
insert into public.cron_esecuzioni (id, nome, iniziato_il, finito_il, esito, estemporaneo)
values
  ('00000000-0000-0000-0000-000000006394', 'allarmi', '2019-02-03 14:00:00+00', '2019-02-03 14:00:03+00', 'ok', true)
on conflict (id) do nothing;
