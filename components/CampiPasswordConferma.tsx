'use client';

import { useState } from 'react';
import { CampoPassword } from './CampoPassword';

// Password + conferma con riscontro in tempo reale (specs/03 -
// utenti-e-ruoli.md, scenario "conferma password in tempo reale"): un
// errore di battitura nella password si scopre subito, non al primo
// login mancato. Il controllo server-side (in creaUtente e in
// impostaPassword) resta l'unica difesa reale — questo è solo un aiuto
// immediato. Nomi/etichette dei campi sono parametrici per poter essere
// riusati sia nel form di creazione utente ("password"/"conferma_password")
// sia in quello con cui l'admin imposta una nuova password per un utente
// già esistente ("nuova_password"/"conferma_nuova_password").
export function CampiPasswordConferma({
  nomePassword = 'password',
  nomeConferma = 'conferma_password',
  etichettaPassword = 'Password',
  etichettaConferma = 'Conferma password',
}: {
  nomePassword?: string;
  nomeConferma?: string;
  etichettaPassword?: string;
  etichettaConferma?: string;
}) {
  const [password, setPassword] = useState('');
  const [conferma, setConferma] = useState('');
  const coincidono = conferma === '' || password === conferma;

  return (
    <>
      <CampoPassword
        name={nomePassword}
        required
        minLength={8}
        placeholder={etichettaPassword}
        ariaLabel={etichettaPassword}
        autoComplete="new-password"
        onChange={setPassword}
      />
      <div className="self-start">
        <CampoPassword
          name={nomeConferma}
          required
          minLength={8}
          placeholder={etichettaConferma}
          ariaLabel={etichettaConferma}
          autoComplete="new-password"
          onChange={setConferma}
        />
        {conferma !== '' && (
          <p className={`mt-1 text-xs ${coincidono ? 'text-green-700' : 'text-red-600'}`}>
            {coincidono ? 'Le password coincidono.' : 'Le password non coincidono.'}
          </p>
        )}
      </div>
    </>
  );
}
