import {textField,numberField,moneyField} from './parser-utils.js';

export function parseGasStationDocument(text=''){
  const fields={
    stationName:textField(text,'stationName',[/^\s*([A-ZÁÉÍÓÚÑ0-9 .&'-]{4,})\s*$/mi],{confidence:.55,rule:'HEADER_CANDIDATE'}),
    crePermit:textField(text,'crePermit',[/PERMISO\s+C\.?\s*R\.?\s*E\.?\s*:?\s*([A-Z0-9\-\/]+)/i,/PERMISO\s*:?\s*(PL-[A-Z0-9\-\/]+)/i],{confidence:.96,rule:'CRE_PERMIT_MATCH'}),
    fuelProduct:textField(text,'fuelProduct',[/\b(MAGNA|PREMIUM|DIESEL|GASOLINA)\b/i],{confidence:.95,rule:'FUEL_PRODUCT_MATCH',normalize:v=>String(v).toUpperCase()}),
    liters:numberField(text,'liters',[/\bLITROS?\s*:?\s*(\d+(?:[.,]\d+)?)/i,/\bVOLUMEN\s*:?\s*(\d+(?:[.,]\d+)?)/i],{confidence:.94}),
    pricePerLiter:moneyField(text,'pricePerLiter',[/PRECIO\s+(?:POR\s+)?LITRO\s*:?\s*\$?\s*([\d.,]+)/i,/\bP\.?\s*U\.?\s*:?\s*\$?\s*([\d.,]+)/i],{confidence:.92}),
  };
  const checks=[];
  if(fields.liters.value!=null&&fields.pricePerLiter.value!=null){
    checks.push({id:'liters-price-amount-candidate',status:'candidate_only',expectedMinor:Math.round(fields.liters.value*fields.pricePerLiter.value),reason:'Fuel volume × price per liter can validate an amount but does not replace labeled TOTAL.'});
  }
  return {parserId:'gas-station-v1',fields,checks};
}
