-- Girasole — Registro elettronico Asilo Sartorio — schema iniziale (Fase 1)
-- Incolla questo file nel SQL Editor di Supabase ed eseguilo una volta sola.

-- Ruoli utente
create type public.ruolo_utente as enum ('admin', 'maestra', 'genitore');

-- Profili (estende auth.users)
create table public.profili (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  cognome text not null default '',
  ruolo ruolo_utente not null default 'genitore',
  created_at timestamptz not null default now()
);

-- Sezioni (classi)
create table public.sezioni (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz not null default now()
);

-- Assegnazione maestre a sezioni (una maestra può seguire più sezioni)
create table public.maestre_sezioni (
  maestra_id uuid not null references public.profili(id) on delete cascade,
  sezione_id uuid not null references public.sezioni(id) on delete cascade,
  primary key (maestra_id, sezione_id)
);

-- Bambini
create table public.bambini (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cognome text not null,
  sezione_id uuid references public.sezioni(id) on delete set null,
  note_allergie text,
  created_at timestamptz not null default now()
);

-- Collegamento bambini-genitori (un bambino può avere più tutori)
create table public.bambini_genitori (
  bambino_id uuid not null references public.bambini(id) on delete cascade,
  genitore_id uuid not null references public.profili(id) on delete cascade,
  primary key (bambino_id, genitore_id)
);

-- Presenze giornaliere
create table public.presenze (
  id uuid primary key default gen_random_uuid(),
  bambino_id uuid not null references public.bambini(id) on delete cascade,
  data date not null,
  stato text not null check (stato in ('presente', 'assente', 'malattia')),
  note text,
  inserita_da uuid references public.profili(id),
  created_at timestamptz not null default now(),
  unique (bambino_id, data)
);

-- Pasti
create table public.pasti (
  id uuid primary key default gen_random_uuid(),
  bambino_id uuid not null references public.bambini(id) on delete cascade,
  data date not null,
  mangiato text not null check (mangiato in ('si', 'no', 'parziale')),
  note text,
  inserito_da uuid references public.profili(id),
  created_at timestamptz not null default now(),
  unique (bambino_id, data)
);

-- Promemoria / comunicazioni
create table public.promemoria (
  id uuid primary key default gen_random_uuid(),
  titolo text not null,
  testo text not null,
  destinatario_tipo text not null check (destinatario_tipo in ('tutti', 'sezione', 'bambino')),
  sezione_id uuid references public.sezioni(id),
  bambino_id uuid references public.bambini(id),
  autore_id uuid references public.profili(id),
  created_at timestamptz not null default now()
);

-- =========================================================
-- Trigger: crea automaticamente un profilo alla registrazione
-- (ruolo di default 'genitore' — admin e maestre vanno promossi
-- manualmente via SQL Editor, vedi checklist di avvio)
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profili (id, nome, cognome, ruolo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', ''),
    coalesce(new.raw_user_meta_data->>'cognome', ''),
    'genitore'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================
-- Row Level Security
-- =========================================================
alter table public.profili enable row level security;
alter table public.sezioni enable row level security;
alter table public.maestre_sezioni enable row level security;
alter table public.bambini enable row level security;
alter table public.bambini_genitori enable row level security;
alter table public.presenze enable row level security;
alter table public.pasti enable row level security;
alter table public.promemoria enable row level security;

-- Helper: ruolo dell'utente corrente
create or replace function public.ruolo_corrente()
returns ruolo_utente
language sql stable
as $$
  select ruolo from public.profili where id = auth.uid();
$$;

-- profili: ognuno vede il proprio, admin vede tutti
create policy "profili_select_own_or_admin" on public.profili
  for select using (id = auth.uid() or public.ruolo_corrente() = 'admin');

-- sezioni: solo staff (admin + maestra)
create policy "sezioni_select_staff" on public.sezioni
  for select using (public.ruolo_corrente() in ('admin', 'maestra'));

-- bambini: admin tutto; maestra solo le proprie sezioni; genitore solo i propri figli
create policy "bambini_select_admin" on public.bambini
  for select using (public.ruolo_corrente() = 'admin');

create policy "bambini_select_maestra" on public.bambini
  for select using (
    public.ruolo_corrente() = 'maestra'
    and exists (
      select 1 from public.maestre_sezioni ms
      where ms.maestra_id = auth.uid() and ms.sezione_id = bambini.sezione_id
    )
  );

create policy "bambini_select_genitore" on public.bambini
  for select using (
    exists (
      select 1 from public.bambini_genitori bg
      where bg.bambino_id = bambini.id and bg.genitore_id = auth.uid()
    )
  );

-- presenze: stessa logica di bambini, propagata via join
create policy "presenze_select" on public.presenze
  for select using (
    public.ruolo_corrente() = 'admin'
    or exists (
      select 1 from public.bambini b
      where b.id = presenze.bambino_id and (
        (public.ruolo_corrente() = 'maestra' and exists (
          select 1 from public.maestre_sezioni ms
          where ms.maestra_id = auth.uid() and ms.sezione_id = b.sezione_id
        ))
        or exists (
          select 1 from public.bambini_genitori bg
          where bg.bambino_id = b.id and bg.genitore_id = auth.uid()
        )
      )
    )
  );

create policy "presenze_insert_staff" on public.presenze
  for insert with check (
    public.ruolo_corrente() = 'admin'
    or exists (
      select 1 from public.bambini b
      join public.maestre_sezioni ms on ms.sezione_id = b.sezione_id
      where b.id = presenze.bambino_id and ms.maestra_id = auth.uid()
    )
  );

create policy "presenze_update_staff" on public.presenze
  for update using (
    public.ruolo_corrente() = 'admin'
    or exists (
      select 1 from public.bambini b
      join public.maestre_sezioni ms on ms.sezione_id = b.sezione_id
      where b.id = presenze.bambino_id and ms.maestra_id = auth.uid()
    )
  );

-- pasti: stesse policy di presenze
create policy "pasti_select" on public.pasti
  for select using (
    public.ruolo_corrente() = 'admin'
    or exists (
      select 1 from public.bambini b
      where b.id = pasti.bambino_id and (
        (public.ruolo_corrente() = 'maestra' and exists (
          select 1 from public.maestre_sezioni ms
          where ms.maestra_id = auth.uid() and ms.sezione_id = b.sezione_id
        ))
        or exists (
          select 1 from public.bambini_genitori bg
          where bg.bambino_id = b.id and bg.genitore_id = auth.uid()
        )
      )
    )
  );

create policy "pasti_insert_staff" on public.pasti
  for insert with check (
    public.ruolo_corrente() = 'admin'
    or exists (
      select 1 from public.bambini b
      join public.maestre_sezioni ms on ms.sezione_id = b.sezione_id
      where b.id = pasti.bambino_id and ms.maestra_id = auth.uid()
    )
  );

create policy "pasti_update_staff" on public.pasti
  for update using (
    public.ruolo_corrente() = 'admin'
    or exists (
      select 1 from public.bambini b
      join public.maestre_sezioni ms on ms.sezione_id = b.sezione_id
      where b.id = pasti.bambino_id and ms.maestra_id = auth.uid()
    )
  );

-- promemoria: staff crea; genitori leggono solo quelli destinati a loro
create policy "promemoria_select" on public.promemoria
  for select using (
    public.ruolo_corrente() in ('admin', 'maestra')
    or destinatario_tipo = 'tutti'
    or (destinatario_tipo = 'sezione' and exists (
      select 1 from public.bambini_genitori bg
      join public.bambini b on b.id = bg.bambino_id
      where bg.genitore_id = auth.uid() and b.sezione_id = promemoria.sezione_id
    ))
    or (destinatario_tipo = 'bambino' and exists (
      select 1 from public.bambini_genitori bg
      where bg.genitore_id = auth.uid() and bg.bambino_id = promemoria.bambino_id
    ))
  );

create policy "promemoria_insert_staff" on public.promemoria
  for insert with check (public.ruolo_corrente() in ('admin', 'maestra'));
