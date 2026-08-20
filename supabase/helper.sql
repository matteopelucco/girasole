-- Promozione del primo admin
-- Nel SQL Editor di girasolev (sostituisci l'email):

insert into public.profili (id, nome, cognome, ruolo, email)
select id, 'Admin', 'Test', 'admin', email
from auth.users
where email = 'admin.test@example.com'
on conflict (id) do update set ruolo = 'admin', email = excluded.email;


-- assegnazione di una maestra alla sezione del seed

insert into public.maestre_sezioni (maestra_id, sezione_id)
select id, '00000000-0000-0000-0000-000000000001'
from auth.users where email = 'maestra.test@example.com'
on conflict do nothing;