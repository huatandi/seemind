import {moneyField,textField,numberField} from './parser-utils.js';

export function parseRestaurantDocument(text=''){
  const fields={
    tip:moneyField(text,'tip',[/\bPROPINA\s*:?\s*\$?\s*([\d.,]+)/i],{confidence:.94,rule:'TIP_MATCH'}),
    table:textField(text,'table',[/\bMESA\s*:?\s*([A-Z0-9\-]+)/i],{confidence:.9,rule:'TABLE_MATCH'}),
    server:textField(text,'server',[/\b(?:MESERO|MESERA|SERVIDOR)\s*:?\s*([^\n]+)/i],{confidence:.86,rule:'SERVER_MATCH'}),
    guests:numberField(text,'guests',[/\b(?:COMENSALES|PERSONAS)\s*:?\s*(\d+)/i],{confidence:.9,rule:'GUEST_COUNT_MATCH'}),
  };
  return {parserId:'restaurant-v1',fields,checks:[]};
}
