import type { SupabaseClient } from '@supabase/supabase-js';
import type { EsitoAzione } from '@/components/FormConEsito';

// Salvataggio di un modello email a riga singola (specs/56 per le rette,
// specs/61 per Rojac): stessa logica per entrambi, quindi un solo punto
// (CLAUDE.md, jscpd). La riga esiste già dal seed della migration, quindi
// è sempre un update, mai un insert. Chi chiama ha già verificato che
// l'utente sia admin (requireAdmin) e rivalida la propria pagina.
export async function salvaModelloEmail(
  supabase: SupabaseClient,
  tabella: 'impostazioni_email_retta' | 'impostazioni_email_rojac',
  formData: FormData
): Promise<EsitoAzione> {
  const oggetto = ((formData.get('oggetto') as string) || '').trim();
  const corpo = ((formData.get('corpo') as string) || '').trim();

  if (!oggetto || !corpo) {
    return { ok: false, messaggio: "Compila sia l'oggetto che il corpo del modello." };
  }

  const { error } = await supabase
    .from(tabella)
    .update({ oggetto, corpo, updated_at: new Date().toISOString() })
    .eq('id', true);
  if (error) {
    return { ok: false, messaggio: 'Impossibile salvare il modello.', dettaglio: error.message };
  }
  return { ok: true };
}
