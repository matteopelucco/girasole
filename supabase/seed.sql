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
