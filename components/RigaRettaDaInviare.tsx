'use client';

import { useState } from 'react';
import Link from 'next/link';
import { InvioSingoloRetta } from './InvioSingoloRetta';
import { Campo } from './ui/campo';
import { TabellaCella, TabellaRiga, TabellaTitolo } from './ui/tabella';
import {
  formattaImporto,
  importoDaCampoRetta,
  riepilogoRigaRetta,
  type ParametriRiepilogoRetta,
} from '@/lib/comunicazioneRetta';
import {
  avvisoGettoniSuperanoAbbonamento,
  TESTO_AVVISO_GETTONI,
  type VocePrePost,
} from '@/lib/prezzi';
import { cn } from '@/lib/utils';

// Importi fissi della riga: tutto ciò che non si modifica dalla tabella
// (specs/56, RET-16). Arrivano dal server; il totale mostrato si ricalcola
// qui con la stessa funzione del server (`calcolaRiepilogoRetta`, RET-17).
export type FissiRiga = Omit<ParametriRiepilogoRetta, 'gettoniPreAsilo' | 'gettoniPostAsilo' | 'costiExtra'>;

type GettoniVoce = { importo: number; numero: number };

// Dati per l'avviso sui gettoni (RET-19..RET-21) di una voce.
type AbbonamentoVoce = {
  attivo: boolean;
  prezzoScheda: number;
  prezzoPrezzi: number | null;
};

// Campo importo modificabile con il simbolo "€" a fianco, fuori dal campo
// compilabile (richiesta dell'utente): condiviso dai quattro campi numerici
// della riga. Con `avviso` il campo prende un rosso tenue e il testo
// dell'avviso lo descrive (`aria-describedby`); non è un errore: niente
// `aria-invalid`, niente `role`, nessun annuncio a ogni tasto.
function CampoImportoConEuro({
  name,
  ariaLabel,
  defaultValue,
  className,
  onChange,
  idAvviso,
}: {
  name: string;
  ariaLabel: string;
  defaultValue: number;
  className: string;
  onChange: (valore: string) => void;
  idAvviso?: string;
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Campo
        misura="piccolo"
        type="number"
        min={0}
        step={0.01}
        defaultValue={defaultValue}
        name={name}
        aria-label={ariaLabel}
        aria-describedby={idAvviso}
        onChange={(e) => onChange(e.target.value)}
        className={cn(className, idAvviso && 'border-danger-border bg-danger-soft')}
      />
      <span className="text-xs text-stone-500">€</span>
    </div>
  );
}

// Cella dei gettoni di una voce: importo modificabile, avviso se supera
// l'abbonamento (RET-19) e numero in sola lettura (viaggia nel form con un
// campo nascosto).
function CellaGettoniDaInviare({
  bambinoId,
  nomeCompleto,
  gettoni,
  voce,
  testo,
  avviso,
  onChange,
}: {
  bambinoId: string;
  nomeCompleto: string;
  gettoni: GettoniVoce;
  voce: VocePrePost;
  testo: string;
  avviso: AbbonamentoVoce;
  onChange: (valore: string) => void;
}) {
  const chiave = voce === 'pre' ? 'pre_asilo' : 'post_asilo';
  const nomeVoce = voce === 'pre' ? 'pre-asilo' : 'post-asilo';
  const mostraAvviso = avvisoGettoniSuperanoAbbonamento({
    importoGettoni: importoDaCampoRetta(testo),
    abbonamentoAttivo: avviso.attivo,
    prezzoAbbonamentoScheda: avviso.prezzoScheda,
    prezzoAbbonamentoPrezzi: avviso.prezzoPrezzi,
  });
  const idAvviso = `avviso-gettoni-${nomeVoce}-${bambinoId}`;
  return (
    <TabellaCella allinea="destra" className="px-2 py-1.5">
      <CampoImportoConEuro
        defaultValue={gettoni.importo}
        name={`gettoni_${chiave}_${bambinoId}`}
        ariaLabel={`Gettoni ${nomeVoce} per ${nomeCompleto}`}
        className="w-14 px-1.5 text-right"
        onChange={onChange}
        idAvviso={mostraAvviso ? idAvviso : undefined}
      />
      {mostraAvviso && (
        <p id={idAvviso} data-testid={`avviso-gettoni-${nomeVoce}`} className="mt-1 text-xs font-medium text-danger-text">
          {TESTO_AVVISO_GETTONI[voce]}
        </p>
      )}
      <input type="hidden" name={`numero_gettoni_${chiave}_${bambinoId}`} value={gettoni.numero} />
      <div className="whitespace-nowrap text-right text-xs text-stone-500" data-testid={`numero-gettoni-${nomeVoce}`}>
        {gettoni.numero} gettoni
      </div>
    </TabellaCella>
  );
}

// Riga di un bambino da comunicare nel mese corrente (specs/56). Conguaglio
// pasti, pre-asilo e post-asilo sono testo (RET-14, RET-15); si modificano solo
// gettoni, costi extra e nota (RET-16) e il totale si aggiorna mentre si scrive
// (RET-17), senza annunci agli screen reader.
export function RigaRettaDaInviare({
  bambino,
  email,
  mese,
  fissi,
  gettoni,
  abbonamento,
  pastiNonUsufruiti,
  notaCreditoDebito,
  oggettoTemplate,
  corpoTemplate,
  formAction,
  formActionSenzaInvio,
}: {
  bambino: { id: string; nome: string; cognome: string };
  email: string;
  mese: string;
  fissi: FissiRiga;
  gettoni: { pre: GettoniVoce; post: GettoniVoce };
  abbonamento: { pre: AbbonamentoVoce; post: AbbonamentoVoce };
  pastiNonUsufruiti: number;
  notaCreditoDebito: string | null;
  oggettoTemplate: string;
  corpoTemplate: string;
  formAction: (formData: FormData) => void | Promise<void>;
  formActionSenzaInvio: (formData: FormData) => void | Promise<void>;
}) {
  const [campi, setCampi] = useState({
    gettoniPreAsilo: String(gettoni.pre.importo),
    gettoniPostAsilo: String(gettoni.post.importo),
    costiExtra: '0',
  });
  const riepilogo = riepilogoRigaRetta(fissi, campi);
  const fisso = riepilogoRigaRetta(fissi, { gettoniPreAsilo: '0', gettoniPostAsilo: '0', costiExtra: '0' });
  const nomeCompleto = `${bambino.nome} ${bambino.cognome}`;
  const cella = 'whitespace-nowrap px-2 py-1.5';

  return (
    <TabellaRiga>
      <TabellaTitolo allinea="sinistra" scope="row" className="whitespace-nowrap px-2 py-1.5 font-normal">
        <Link href={`/admin/bambini/${bambino.id}`} className="hover:underline">
          {nomeCompleto}
        </Link>
        <div className="text-xs text-stone-500">({email})</div>
      </TabellaTitolo>
      <TabellaCella allinea="destra" className={cella}>{formattaImporto(fisso.rettaMensile)} €</TabellaCella>
      <TabellaCella allinea="destra" className={cella}>{formattaImporto(fisso.marcaDaBollo)} €</TabellaCella>
      <TabellaCella allinea="destra" className={cella}>{formattaImporto(fisso.costoPasti)} €</TabellaCella>
      <TabellaCella allinea="destra" className={cella}>
        <div data-testid="conguaglio-pasti">{formattaImporto(fisso.conguaglioPasti)} €</div>
        <div className="text-xs text-stone-500" data-testid="pasti-non-usufruiti">
          {pastiNonUsufruiti} pasti non usufruiti
        </div>
      </TabellaCella>
      <TabellaCella allinea="destra" className={cella} data-testid="costo-pre-asilo">
        {formattaImporto(fisso.costoPreAsilo)} €
      </TabellaCella>
      <TabellaCella allinea="destra" className={cella} data-testid="costo-post-asilo">
        {formattaImporto(fisso.costoPostAsilo)} €
      </TabellaCella>
      <CellaGettoniDaInviare
        bambinoId={bambino.id}
        nomeCompleto={nomeCompleto}
        gettoni={gettoni.pre}
        voce="pre"
        testo={campi.gettoniPreAsilo}
        avviso={abbonamento.pre}
        onChange={(valore) => setCampi((c) => ({ ...c, gettoniPreAsilo: valore }))}
      />
      <CellaGettoniDaInviare
        bambinoId={bambino.id}
        nomeCompleto={nomeCompleto}
        gettoni={gettoni.post}
        voce="post"
        testo={campi.gettoniPostAsilo}
        avviso={abbonamento.post}
        onChange={(valore) => setCampi((c) => ({ ...c, gettoniPostAsilo: valore }))}
      />
      <TabellaCella allinea="destra" className={cella}>
        <CampoImportoConEuro
          defaultValue={0}
          name={`costi_extra_${bambino.id}`}
          ariaLabel={`Costi extra per ${nomeCompleto}`}
          className="w-16 px-1.5 text-right"
          onChange={(valore) => setCampi((c) => ({ ...c, costiExtra: valore }))}
        />
      </TabellaCella>
      <TabellaCella allinea="sinistra" className="px-2 py-1.5">
        <Campo
          misura="piccolo"
          type="text"
          name={`note_extra_${bambino.id}`}
          placeholder="Nota (opzionale)"
          aria-label={`Nota costi extra per ${nomeCompleto}`}
          className="w-32 px-1.5"
        />
      </TabellaCella>
      <TabellaCella allinea="destra" className="px-2 py-1.5">
        <div>{formattaImporto(fisso.creditoDebito)} €</div>
        {notaCreditoDebito && <div className="text-left text-xs text-stone-500">{notaCreditoDebito}</div>}
      </TabellaCella>
      <TabellaCella allinea="destra" className={cn(cella, 'font-medium')} data-testid="totale-riga">
        {formattaImporto(riepilogo.totale)} €
      </TabellaCella>
      <TabellaCella allinea="sinistra" className="whitespace-nowrap px-2 py-1.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-stone-500">Da inviare</span>
          <InvioSingoloRetta
            bambinoId={bambino.id}
            nome={bambino.nome}
            cognome={bambino.cognome}
            email={email}
            mese={mese}
            rettaMensile={fisso.rettaMensile}
            marcaDaBollo={fisso.marcaDaBollo}
            costoPasti={fisso.costoPasti}
            conguaglioPasti={fisso.conguaglioPasti}
            costoPreAsilo={fisso.costoPreAsilo}
            costoPostAsilo={fisso.costoPostAsilo}
            creditoDebito={fisso.creditoDebito}
            notaCreditoDebito={notaCreditoDebito}
            oggettoTemplate={oggettoTemplate}
            corpoTemplate={corpoTemplate}
            formAction={formAction}
            formActionSenzaInvio={formActionSenzaInvio}
          />
        </div>
      </TabellaCella>
    </TabellaRiga>
  );
}
