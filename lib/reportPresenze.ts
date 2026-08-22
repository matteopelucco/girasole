import { createAdminClient } from '@/lib/supabase/admin';
import { formattaDataItaliana } from '@/lib/date';

const ETICHETTE_STATO: Record<string, string> = {
  presente: 'Presente',
  assente: 'Assente',
  malattia: 'Malattia',
};

// Scheda HTML delle presenze/assenze/malattie di una data, raggruppata
// per classe attiva — usata dal report notturno (specs/13 -
// segna-presenza.md). Usa la service_role key (bypassa la RLS): il cron
// non ha una sessione utente e deve poter leggere tutte le classi.
export async function generaSchedaGiornalieraHtml(data: string): Promise<string> {
  const supabase = createAdminClient();

  const [{ data: sezioni }, { data: bambini }, { data: presenze }] = await Promise.all([
    supabase.from('sezioni').select('id, nome').eq('attiva', true).order('nome'),
    supabase.from('bambini').select('id, nome, cognome, sezione_id').order('cognome'),
    supabase.from('presenze').select('bambino_id, stato, note').eq('data', data),
  ]);

  const presenzaPerBambino = new Map((presenze ?? []).map((p) => [p.bambino_id, p]));

  const sezioniHtml = (sezioni ?? [])
    .map((sezione) => {
      const bambiniSezione = (bambini ?? []).filter((b) => b.sezione_id === sezione.id);
      if (!bambiniSezione.length) return '';

      const righe = bambiniSezione
        .map((b) => {
          const presenza = presenzaPerBambino.get(b.id);
          const stato = presenza ? ETICHETTE_STATO[presenza.stato] ?? presenza.stato : 'Non segnato';
          const nota = presenza?.note ? ` — ${presenza.note}` : '';
          return `<li>${b.nome} ${b.cognome}: <strong>${stato}</strong>${nota}</li>`;
        })
        .join('');

      return `<h2>${sezione.nome}</h2><ul>${righe}</ul>`;
    })
    .join('');

  return `<h1>Presenze del ${formattaDataItaliana(data)}</h1>${
    sezioniHtml || '<p>Nessuna classe attiva.</p>'
  }`;
}
