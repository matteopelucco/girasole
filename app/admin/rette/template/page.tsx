import { PaginaModelloEmail } from '@/components/PaginaModelloEmail';
import { requireAdmin } from '@/lib/auth';
import { aggiornaTemplateEmailRetta } from './actions';

export const dynamic = 'force-dynamic';

const PLACEHOLDER_DISPONIBILI = [
  '{{nome}}',
  '{{cognome}}',
  '{{mese}}',
  '{{retta_mensile}}',
  '{{costo_pasti}}',
  '{{conguaglio_pasti}}',
  '{{marca_da_bollo}}',
  '{{costo_pre_asilo}}',
  '{{costo_post_asilo}}',
  '{{costi_extra}}',
  '{{note_costi_extra}}',
  '{{credito_debito}}',
  '{{nota_credito_debito}}',
  '{{totale}}',
];

export default async function TemplateEmailRettaPage() {
  const { supabase, user, profilo } = await requireAdmin();

  const { data: template } = await supabase
    .from('impostazioni_email_retta')
    .select('oggetto, corpo, updated_at')
    .eq('id', true)
    .maybeSingle();

  return (
    <PaginaModelloEmail
      nome={profilo?.nome || user.email || ''}
      ruolo={profilo?.ruolo ?? null}
      hrefIndietro="/admin/rette"
      etichettaIndietro="Torna a Rette"
      titolo="Modello email retta"
      descrizione="Placeholder disponibili (sostituiti con i dati del bambino e del mese al momento dell'invio, importi già formattati in euro):"
      placeholder={PLACEHOLDER_DISPONIBILI}
      action={aggiornaTemplateEmailRetta}
      modello={template}
    />
  );
}
