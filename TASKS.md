# TASKS.md

Solo le voci **aperte**. Lo storico completo (sezioni chiuse, dettagli di
ogni intervento) è in [docs/tasks-archivio.md](docs/tasks-archivio.md):
consultarlo solo quando serve il contesto di una voce passata, non ad ogni
sessione. Quando si chiude una sezione, spostarla nell'archivio.

Nota: molte voci "applica la migration nel SQL Editor" risalgono a prima
di A22/A23 (`supabase db push` e reset del DB di test in CI). In test sono
superate dal reset; in produzione vanno verificate una volta e chiuse.

## Bug fix: alunno duplicato + nota presenza/pasto non salvabile  
_(dettagli in archivio)_
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0010_alunno_univoco.sql` nel SQL Editor di
      Supabase (test e produzione) — senza, il vincolo non è attivo e
      un alunno duplicato viene comunque creato senza errore. **Nota
      anche**: verificando questo fix ho scoperto che
      `0008_fix_grant_tabelle_04.sql` (permessi su `anni_scolastici`,
      commit precedente) non risulta applicata sul progetto di test —
      creare un anno scolastico da `/admin` fallisce ancora con
      "permission denied for table anni_scolastici". Applica anche
      quella, insieme alla `0009_scrittura_solo_oggi_maestra.sql` già
      segnalata sopra, se non fatto.

## Requisito 50: gestione classi/bambini dall'admin (visualizzazione, modifica, disattivazione)  
_(dettagli in archivio)_
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0011_bambino_attivo.sql` (se non già fatto)
      nel SQL Editor di Supabase (test e produzione). Ho anche
      verificato che `0010_alunno_univoco.sql` non sta bloccando i
      duplicati sul progetto di test: molto probabilmente la sua
      `CREATE UNIQUE INDEX` ha fallito silenziosamente perché esisteva
      già una coppia di alunni duplicati (creata durante lo sviluppo,
      prima che il vincolo esistesse). Per sbloccarla:
      ```sql
      -- 1. Trova i duplicati che bloccano il vincolo
      select lower(nome), lower(cognome), data_nascita, count(*), array_agg(id) as ids
      from public.bambini
      group by lower(nome), lower(cognome), data_nascita
      having count(*) > 1;

## Sessione di test con un'insegnante: bug fix, miglioramenti, requisito 51 (Report)  
_(dettagli in archivio)_
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0012_pasto_senza_parziale.sql` e
      `supabase/migrations/0013_report_anagrafica.sql` nel SQL Editor di
      Supabase (test e produzione) — senza la 0012, modificare/eliminare
      un promemoria non ha effetto (RLS silenziosamente non aggiorna/
      elimina nulla, 2 test restano rossi:
      `e2e/15-memo.spec.ts`); senza la 0013, l'anagrafica classi non
      mostra colleghe/genitori a una maestra.

## Ruolo Assistente, pre/post-asilo, report email automatico  
_(dettagli in archivio)_
- [ ] **Da fare da parte tua — verificato due volte, ancora mancante**:
      l'account di test `assistente.test@example.com` non esiste ancora
      in Supabase Auth. Il blocco SQL in `supabase/helper.sql` da solo
      non può crearlo: esegue una `select ... from auth.users where
      email = '...'`, e se quella select non trova righe (perché
      l'utente Auth non esiste) l'insert successivo su `profili` non
      inserisce nulla, silenziosamente — la query "va a buon fine" (0
      righe interessate) ma non fa quello che serve. Prima di rilanciare
      quel blocco SQL, l'utente Auth va creato **dalla Dashboard
      Supabase**: Authentication → Users → Add user → email
      `assistente.test@example.com`, password `testtest` (o il valore
      che hai in `E2E_ASSISTENTE_PASSWORD` su `.env.local`), spunta
      "Auto Confirm User". Solo dopo, rilancia il blocco SQL per
      assistente in `supabase/helper.sql`. Verificabile da riga di
      comando senza aprire il browser: `node -e "..."` con
      `admin.auth.admin.listUsers()` (service role) per controllare se
      l'email compare — è così che ho verificato che manca ancora.
      Dopo questo passaggio gli scenari assistente di specs/03, 12, 13,
      14, 15, 51 smettono di saltarsi.
- [ ] Lo scenario "idempotenza per tipo" di `e2e/52-report-email-automatico.spec.ts`
      chiama davvero l'API di Resend: non verificabile dall'ambiente
      sandbox di sviluppo usato per questa sessione (nessun accesso di
      rete in uscita). La sotto-parte "rifiuta senza il secret corretto"
      (nessuna chiamata di rete) è verde. Consigliato un giro manuale
      (`npx playwright test e2e/52-report-email-automatico.spec.ts`) dal
      tuo ambiente locale con accesso a Internet.
- [ ] Facoltativo: se vuoi provare l'invio reale del report notturno con
      PDF allegati, `RESEND_API_KEY`/`CRON_SECRET` sono già configurati
      da requisiti precedenti — nessun secret nuovo necessario.

## Bug: report notturno "Nessuna classe attiva" nonostante dati presenti  
_(dettagli in archivio)_
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0018_grant_service_role_report.sql` nel SQL
      Editor di Supabase (test e produzione) — senza, il report notturno
      continua a fallire con lo stesso errore di permessi.

## Il pasto non è selezionabile anche per un bambino malato (specs/14)  
_(dettagli in archivio)_
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0017_pasto_blocca_anche_malattia.sql` nel SQL
      Editor di Supabase (test e produzione) — senza, il blocco vale
      solo in UI: un tentativo diretto via API/DB potrebbe ancora
      inserire un pasto per un bambino malato.

## Comunicazione pasti a Rojac (nuovo specs/16)  
_(dettagli in archivio)_
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0019_pasti_comunicati_rojac.sql` nel SQL
      Editor di Supabase (test e produzione) — senza, il pulsante
      "Pasti comunicati a Rojac" fallisce (tabella inesistente) e il
      trigger di blocco non esiste.
- [ ] **Da fare da parte tua**:
      1. Applica `supabase/migrations/0020_pasti_comunicati_globale.sql`
         nel SQL Editor di Supabase (test e produzione) — sostituisce
         `0019`, sicuro da eseguire anche se `0019` non è mai stata
         applicata.
      2. Applica anche
         `supabase/migrations/0021_fix_grant_insert_pasti_comunicati.sql`
         (dopo la 0020) — senza questo grant il pulsante "Conferma
         pasti" fallisce con "permission denied", come già capitato in
         produzione.
      3. Verifica manualmente **una volta** il click reale su "Conferma"
         (numero pasti, invio mail a info@asilosartorio.it, blocco
         effettivo su tutte le classi) — non coperto da e2e per il
         motivo spiegato sopra.

## Icona per "Aggiungi a schermata Home" (Android/iOS)  
_(dettagli in archivio)_
- [ ] **Da verificare da parte tua**: su un telefono Android, apri il
      sito, menu Chrome → "Aggiungi a schermata Home" — deve comparire
      l'icona del girasole (non più la "V") e la scritta "Girasole"
      sotto (non più il titolo intero). L'icona già installata prima di
      questa modifica non si aggiorna da sola: va rimossa e
      riaggiunta.

## Calendario scolastico: giorni di chiusura (nuovo specs/53)  
_(dettagli in archivio)_
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0022_calendario_scolastico.sql` nel SQL Editor
      di Supabase (test e produzione) prima di usare `/admin/calendario`
      — senza, la tabella `giorni_chiusura` non esiste e la pagina fallisce
      nel caricare l'elenco.

## Ore di lavoro: abilitazione per utente e quarta sezione in dashboard (v0.13.0)  
_(dettagli in archivio)_
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0023_ore_lavoro_abilitazione.sql` nel SQL
      Editor di Supabase (test e produzione) prima di usare la nuova
      abilitazione — senza, `/admin/maestre` e la dashboard falliscono
      a leggere/scrivere la colonna `abilitato_ore_lavoro`.

## Profili orari: definizione e assegnazione al personale (v0.14.0)  
_(dettagli in archivio)_
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0024_profili_orari.sql` nel SQL Editor di
      Supabase (test e produzione) prima di usare `/admin/profili-orari`
      — senza, la tabella `profili_orari` e la colonna
      `profili.profilo_orario_id` non esistono.

## Report ore di lavoro: form settimanale, malattia/assenza, conferma (v0.15.0)  
_(dettagli in archivio)_
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0025_report_ore_lavoro.sql` nel SQL Editor
      di Supabase (test e produzione) prima di usare
      `/dashboard/ore-lavoro` — senza, la pagina fallisce a leggere/
      scrivere le tabelle `ore_lavoro_giorni`/`ore_lavoro_settimane`.

## Ore di lavoro: registrabili anche nei giorni di chiusura scolastica (v0.15.1)  
_(dettagli in archivio)_
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0026_ore_lavoro_permesse_giorni_chiusi.sql`
      nel SQL Editor di Supabase (test e produzione) — senza, il
      trigger continua a bloccare le ore nei giorni di chiusura.

## Allarmi: presenze/pasti entro mezzogiorno, settimana ore non confermata (v0.17.0)  
_(dettagli in archivio)_
- [ ] **Da fare da parte tua**:
      1) applica `supabase/migrations/0027_allarmi.sql` nel SQL Editor
      di Supabase (test e produzione) prima che il cron/i banner
      funzionino;
      2) su Vercel, il nuovo cron in `vercel.json` (`/api/cron/allarmi`)
      viene registrato automaticamente al prossimo deploy — verifica
      però che il piano Vercel copra 2 cron job (Hobby ne consente 2,
      ci arriviamo esattamente con questo); se in futuro serve un terzo
      cron, servirà valutare un piano superiore o accorpare ulteriormente.

## Navigazione tra settimane in "Ore di lavoro" (v0.18.0)  
_(dettagli in archivio)_
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0028_ore_lavoro_navigazione_settimane.sql`
      nel SQL Editor di Supabase (test e produzione). Nessuna modifica
      lato Vercel richiesta da questa feature.

## Bug: impossibile salvare le ore a metà settimana (v0.18.1)  
_(dettagli in archivio)_
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0029_fix_ore_lavoro_vincolo_futuro.sql` nel
      SQL Editor di Supabase (test e produzione), subito dopo la 0028 se
      non ancora applicata, o al suo posto se 0028 è già a posto ma con
      questo bug. Nessuna modifica lato Vercel richiesta.

## Bug: "Conferma settimana" andava in errore (Server Components render)  
_(dettagli in archivio)_
- [ ] **Da fare da parte tua**: applica
      `supabase/migrations/0030_profili_orari_self_select.sql` nel SQL
      Editor di Supabase (test e produzione) — senza, il precaricamento
      delle ore ordinarie resta a 0 per chiunque non sia admin.

## Fix: cron notturno in errore su "Ore di lavoro" (permission denied per profili)  
_(dettagli in archivio)_
- [ ] Da applicare nel SQL Editor di Supabase (progetto di test E di
      produzione) — senza, il cron notturno continua a fallire sul
      riepilogo ore.

## A17 · Documentare il flusso remoto (telefono) (2026-09-23)  
_(dettagli in archivio)_
- [ ] **Il criterio "Fatto quando" di A17/#21 non è verificato da questa
      attività**: richiede un test dal vivo, interamente da telefono, che
      solo Matteo può eseguire (issue → sessione cloud → draft PR → CI →
      review → merge). La parte documentale è pronta per la review, ma A17
      resta sostanzialmente aperta finché quel test non è fatto — la issue
      #21 va in `status:review`, non `status:done`.

## A20 · Supabase CLI: init e link a test e prod (2026-09-23)  
_(dettagli in archivio)_
- [ ] **Non eseguiti** `supabase login` e `supabase link`, di proposito:
      richiedono un token personale Supabase o un login interattivo via
      browser, più il project-ref di due progetti reali (test e
      produzione) che l'agente non ha e non deve indovinare — in
      particolare il project-ref di produzione è un identificatore reale
      del sistema in uso, non va mai improvvisato né chiesto in chiaro in
      un file di questo repo pubblico o in un commento GitHub.

## A24 · Account-ruolo di test ricreati ad ogni reset CI (2026-09-24)  
_(dettagli in archivio)_
- [ ] **Scope volutamente escluso**: nessuna assegnazione di sezione
      (`maestre_sezioni`) a maestra/assistente — non richiesta dal
      criterio "Fatto quando" (login, non copertura dati) e avrebbe
      richiesto un nuovo GRANT per `service_role`. Gli scenari che si
      auto-saltano con "nessuna sezione assegnata a questo account"
      restano saltati: è lavoro di A25.
- [ ] **Non verificabile in locale in questa sessione** (nessuna
      credenziale Supabase di test nell'ambiente dell'agente): il
      criterio "due run consecutivi di CI danno lo stesso esito di
      login" va confermato con un run CI reale dopo il merge.

## #70 · e2e: logout limitato alla sessione corrente (2026-09-25)  
_(dettagli in archivio)_
- [ ] Da confermare con la CI: suite e2e verde fino in fondo.

## #80 · Dependabot: vitest 4 → 5 (rimandato, 2026-09-25)
- [ ] Rimandato: vitest 5 richiede `@types/node` ^22 o ≥24 (ora ^20),
      quindi `npm ci` fallisce. Riprendere alzando `@types/node` e
      verificando `vitest.config.ts` contro i breaking change di v5.

## Backlog — Fase 2/3
- [x] Registrare i bonifici ricevuti, con le opportune note — vedi
      "Crediti/debiti di un bambino e verifica del bonifico retta" sopra
      (`specs/59 - verifica-bonifico-retta.md`)
- [ ] Stato di pagamento/saldo per bambino — solo parzialmente coperto:
      crediti/debiti (`specs/58`) e verifica bonifico (`specs/59`) sono
      per singola comunicazione/mese, non ancora una vista di saldo
      complessivo aggregato per bambino
- [ ] Portale genitori (UI dedicata)
