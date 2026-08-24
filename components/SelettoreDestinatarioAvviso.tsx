'use client';

import { useMemo, useState } from 'react';

type Sezione = { id: string; nome: string };
type Bambino = { id: string; nome: string; cognome: string; sezione_id: string | null };
type TipoDestinatario = 'tutti' | 'sezione' | 'bambino';

// Selezione a cascata del destinatario di un avviso (specs/15 - memo.md):
// "Tutti" non richiede altro; "Una sezione" rivela il campo sezione;
// "Un bambino" rivela prima il campo sezione (usato solo come filtro,
// non salvato) e poi, scelta la sezione, il campo bambino con il solo
// elenco di quella sezione — non più un unico elenco piatto con tutti i
// bambini di tutte le classi.
//
// Il campo sezione condivide lo stesso `name="sezione_id"` sia per il
// caso "Una sezione" (destinatario reale, salvato) sia per il caso
// "Un bambino" (solo filtro): la server action lo ignora comunque
// quando `destinatario_tipo` è "bambino" (vedi app/dashboard/actions.ts),
// quindi non serve un campo separato.
export function SelettoreDestinatarioAvviso({
  sezioni,
  bambini,
  defaultTipo = 'tutti',
  defaultSezioneId = '',
  defaultBambinoId = '',
}: {
  sezioni: Sezione[];
  bambini: Bambino[];
  defaultTipo?: TipoDestinatario;
  defaultSezioneId?: string;
  defaultBambinoId?: string;
}) {
  // In modifica, un avviso destinato a un bambino ha solo bambino_id
  // salvato (non sezione_id): risalgo alla sezione di quel bambino per
  // pre-selezionare il filtro.
  const sezioneInizialeBambino = useMemo(() => {
    if (defaultTipo !== 'bambino' || !defaultBambinoId) return '';
    return bambini.find((b) => b.id === defaultBambinoId)?.sezione_id ?? '';
  }, [defaultTipo, defaultBambinoId, bambini]);

  const [tipo, setTipo] = useState<TipoDestinatario>(defaultTipo);
  const [sezioneId, setSezioneId] = useState(
    defaultTipo === 'sezione' ? defaultSezioneId : sezioneInizialeBambino
  );

  const bambiniDellaSezione = useMemo(
    () => bambini.filter((b) => b.sezione_id === sezioneId),
    [bambini, sezioneId]
  );

  return (
    <div className="flex flex-wrap gap-2">
      <select
        name="destinatario_tipo"
        aria-label="Destinatario"
        value={tipo}
        onChange={(e) => {
          const nuovoTipo = e.target.value as TipoDestinatario;
          setTipo(nuovoTipo);
          if (nuovoTipo === 'tutti') setSezioneId('');
        }}
        className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500 sm:w-auto"
      >
        <option value="tutti">Tutti</option>
        <option value="sezione">Una sezione</option>
        <option value="bambino">Un bambino</option>
      </select>

      {tipo !== 'tutti' && (
        <select
          name="sezione_id"
          aria-label="Sezione"
          required
          value={sezioneId}
          onChange={(e) => setSezioneId(e.target.value)}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500 sm:w-56"
        >
          <option value="" disabled>
            Sezione
          </option>
          {sezioni.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
      )}

      {tipo === 'bambino' && sezioneId && (
        <select
          name="bambino_id"
          aria-label="Bambino"
          required
          defaultValue={defaultBambinoId}
          key={sezioneId}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500 sm:w-56"
        >
          <option value="" disabled>
            Bambino
          </option>
          {bambiniDellaSezione.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nome} {b.cognome}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
