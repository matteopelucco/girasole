-- Girasole — Funzione di sola lettura "copertura pre/post-asilo"
-- (issue #399, parte di #401; specs/13 GET-08 e GET-11, specs/03, specs/55).
-- Applicazione: in test con `supabase db push --project-ref <ref-test>`; in
-- produzione solo Matteo, a mano, con `--project-ref` esplicito e PRIMA con
-- `--dry-run` (mai SQL Editor, mai automazioni).
--
-- Ordine di rilascio: dopo la 0069 (#398); applicare subito dopo il merge,
-- prima di usare la nuova versione dell'app (la schermata presenze chiama la
-- funzione; se manca, le scritte non compaiono ma la pagina funziona).
--
-- Perché serve: maestra e assistente non leggono `costi_bambini` (specs/03),
-- ma devono sapere se un pre/post-asilo è già pagato dall'abbonamento. La
-- funzione restituisce SOLO sì/no (mai prezzi, gettoni o altri dati di costi).
--
-- Cosa fa, per i bambini ATTIVI che il chiamante può già vedere (admin: tutti;
-- maestra e assistente: solo quelli delle proprie sezioni, come le policy RLS
-- di `bambini`/`presenze`):
--   * pre/post coperto, per il mese solare di p_data: se la retta di quel mese
--     è già in `comunicazioni_retta` vale cosa fu addebitato (costo > 0),
--     altrimenti il flag attuale di `costi_bambini` (nessuna riga = non coperto);
--   * retta_successiva_inviata: esiste la retta del mese dopo p_data.
-- Respinti con SQLSTATE 42501: genitore, utente senza profilo, anonimo (nessun
-- EXECUTE). Data nulla: 22004.
--
-- Nessuna tabella nuova: nessun GRANT su tabelle; solo EXECUTE minimo qui sotto.

create or replace function public.copertura_pre_post_asilo(p_data date)
returns table (
  bambino_id uuid,
  pre_asilo_coperto boolean,
  post_asilo_coperto boolean,
  retta_successiva_inviata boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ruolo public.ruolo_utente;
  v_mese text;
  v_mese_successivo text;
begin
  v_ruolo := public.ruolo_corrente();
  if v_ruolo is null or v_ruolo not in ('admin', 'maestra', 'assistente') then
    raise exception 'Operazione non consentita' using errcode = '42501';
  end if;
  if p_data is null then
    raise exception 'Data obbligatoria' using errcode = '22004';
  end if;

  v_mese := to_char(p_data, 'YYYY-MM');
  v_mese_successivo := to_char(date_trunc('month', p_data) + interval '1 month', 'YYYY-MM');

  return query
  select
    b.id,
    coalesce(r.costo_pre_asilo > 0, c.pre_asilo_richiesto, false),
    coalesce(r.costo_post_asilo > 0, c.post_asilo_richiesto, false),
    exists (
      select 1 from public.comunicazioni_retta s
      where s.bambino_id = b.id and s.mese = v_mese_successivo
    )
  from public.bambini b
  left join public.costi_bambini c on c.bambino_id = b.id
  left join public.comunicazioni_retta r on r.bambino_id = b.id and r.mese = v_mese
  where b.attiva
    and (
      v_ruolo = 'admin'
      or exists (
        select 1 from public.maestre_sezioni ms
        where ms.maestra_id = auth.uid() and ms.sezione_id = b.sezione_id
      )
    );
end;
$$;

revoke all on function public.copertura_pre_post_asilo(date) from public, anon, authenticated, service_role;
grant execute on function public.copertura_pre_post_asilo(date) to authenticated;
