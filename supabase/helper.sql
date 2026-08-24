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

-- Account di test per il ruolo assistente (specs/03 - utenti-e-ruoli.md).
-- Crea prima l'utente Auth dalla Dashboard Supabase (Authentication →
-- Add user, email/password come da E2E_ASSISTENTE_EMAIL/PASSWORD in
-- .env.local), poi esegui questo blocco per impostare ruolo e sezione.
insert into public.profili (id, nome, cognome, ruolo, email)
select id, 'Assistente', 'Test', 'assistente', email
from auth.users
where email = 'assistente.test@example.com'
on conflict (id) do update set ruolo = 'assistente', email = excluded.email;

insert into public.maestre_sezioni (maestra_id, sezione_id)
select id, '00000000-0000-0000-0000-000000000001'
from auth.users where email = 'assistente.test@example.com'
on conflict do nothing;