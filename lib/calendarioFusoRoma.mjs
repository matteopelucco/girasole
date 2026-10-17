// Definizione iCalendar del fuso Europe/Rome (regole UE: ora legale dall'ultima
// domenica di marzo all'ultima di ottobre). Serve a lib/calendarioIcal.ts come
// ripiego quando il feed usa Europe/Rome senza includerne la definizione
// (VTIMEZONE), e ai test e2e per costruire un feed finto (specs/64).
export const VTIMEZONE_ROMA = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Rome',
  'X-LIC-LOCATION:Europe/Rome',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
].join('\r\n');
