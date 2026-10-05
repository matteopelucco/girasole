import { PaginaModelloEmail } from '@/components/PaginaModelloEmail';
import { requireAdmin } from '@/lib/auth';
import { aggiornaTemplateEmailRojac } from './actions';

export const dynamic = 'force-dynamic';

const PLACEHOLDER_DISPONIBILI = [
  '{{mese}}',
  '{{pasti_bambini}}',
  '{{pasti_insegnanti}}',
  '{{giorni_scuola}}',
  '{{totale_pasti}}',
];

// specs/61 - email-pasti-rojac.md: modello della mail mensile a Rojac,
// raggiungibile dal riquadro "Mail mensile a Rojac" del Report.
export default async function TemplateEmailRojacPage() {
  const { supabase, user, profilo } = await requireAdmin();

  const { data: template } = await supabase
    .from('impostazioni_email_rojac')
    .select('oggetto, corpo, updated_at')
    .eq('id', true)
    .maybeSingle();

  return (
    <PaginaModelloEmail
      nome={profilo?.nome || user.email || ''}
      ruolo={profilo?.ruolo ?? null}
      hrefIndietro="/dashboard/report"
      etichettaIndietro="Torna a Report"
      titolo="Modello email Rojac"
      descrizione="Placeholder disponibili (sostituiti con i numeri del mese al momento dell'invio):"
      placeholder={PLACEHOLDER_DISPONIBILI}
      action={aggiornaTemplateEmailRojac}
      modello={template}
    />
  );
}
