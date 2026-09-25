# ADR-0003 — "L'effetto è la conferma": niente notifiche di successo aggiuntive

- Stato: Accettata
- Data: 2026-08-22, regola "Ultimo salvataggio" estesa a tutti i form di
  modifica dopo un bug utente (data di questa estensione non
  documentata con precisione in `docs/tasks-archivio.md`)

## Contesto
specs/05 - feedback.md definisce come l'app comunica l'esito di
un'azione che scrive sul database. Per un'azione che produce un effetto
visibile ovvio (un nuovo elemento in un elenco, una riga rimossa, un
badge aggiornato) una notifica di successo aggiuntiva (banner, toast)
sarebbe ridondante e invasiva. Per un form di modifica in cui i campi
restano visivamente identici dopo un salvataggio riuscito, invece,
inizialmente non c'era alcun effetto visibile — un bug segnalato
dall'utente (il salvataggio dei costi di un bambino sembrava non avere
effetto).

## Decisione
Il successo di un'azione non genera mai una notifica aggiuntiva
(banner/toast): l'effetto stesso dell'azione è la conferma. Dove l'unica
differenza osservabile è quella richiesta esplicitamente ("Ultimo
salvataggio: {data} alle {ora}" sotto il pulsante, basato sulla colonna
`updated_at`, bumpata esplicitamente ad ogni salvataggio), quello è
l'effetto visibile — non un'eccezione alla regola.

## Conseguenze
- Positive: UI meno invasiva; un solo pattern di feedback
  (`components/PulsanteInvio.tsx`, `components/FormConEsito.tsx`) da
  mantenere per started/running/done/errore, invece di notifiche ad hoc
  pagina per pagina.
- Negative: ogni nuovo form di modifica deve garantire un effetto
  visibile reale dopo il salvataggio (di norma `updated_at` +
  "Ultimo salvataggio"), altrimenti un salvataggio riuscito appare
  silenzioso e indistinguibile da un mancato invio — è la classe di bug
  che ha originato l'estensione della regola a tutti i form esistenti
  (bambino, costi bambino, giorno di chiusura, profilo orario, utente,
  avviso, settimana di ore di lavoro).
- Le uniche eccezioni documentate sono login e richiesta di recupero
  password, che per motivi di sicurezza (anti-enumeration) non mostrano
  un dettaglio tecnico sull'errore — non riguardano il "niente notifiche
  di successo" ma il dettaglio dell'errore (vedi specs/05, "Eccezioni
  deliberate").
