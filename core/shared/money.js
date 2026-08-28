/**
 * Shared deterministic money formatting.
 *
 * Single source of truth for minor-unit -> display-string conversion.
 * Display locale is always explicit: callers may pass an exact BCP-47
 * locale (from Global Context), otherwise a fixed default is used.
 * Falling back to the OS locale made golden tests fail on machines
 * outside en-US regions ('USD 108,00' vs '$108.00') and must never happen.
 */
export const DEFAULT_MONEY_LOCALE='en-US';

export function formatMoneyMinor(minorUnits,{locale=null,currency='XXX'}={}){
  if(minorUnits==null)return String(minorUnits);
  const v=Number(minorUnits);
  if(!Number.isFinite(v))return String(minorUnits);
  const code=String(currency??'XXX').toUpperCase();
  try{
    return new Intl.NumberFormat(locale||DEFAULT_MONEY_LOCALE,{
      style:'currency',
      // XXX = unresolved currency per Global Context rules; render with the
      // neutral USD symbol rather than leaking an OS-dependent choice.
      currency:code==='XXX'?'USD':code,
    }).format(v/100);
  }catch{
    return String(v);
  }
}
