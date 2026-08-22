'use server';

import { revalidatePath } from 'next/cache';
import { requireProfilo, assicuraScrivibile } from '@/lib/auth';

// segnaPresenza è legata a bottoni diversi dentro allo stesso form (vedi
// app/dashboard/presenze/[sezioneId]/page.tsx): niente useFormState, il
// feedback "ko" (specs/05 - feedback.md) passa dal sollevare l'errore,
// intercettato da app/error.tsx.
export async function segnaPresenza(
  bambinoId: string,
  stato: 'presente' | 'assente' | 'malattia',
  sezioneId: string,
  data: string,
  formData: FormData
) {
  const { supabase, user, profilo } = await requireProfilo();
  assicuraScrivibile(profilo?.ruolo, data);

  const note = (formData.get('nota_presenza') as string)?.trim() || null;

  const { error } = await supabase.from('presenze').upsert(
    {
      bambino_id: bambinoId,
      data,
      stato,
      note,
      inserita_da: user.id,
    },
    { onConflict: 'bambino_id,data' }
  );
  if (error) throw new Error(`Impossibile salvare la presenza: ${error.message}`);

  revalidatePath(`/dashboard/presenze/${sezioneId}`);
}
