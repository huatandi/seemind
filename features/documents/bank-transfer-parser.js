import {textField,moneyField,lastDigits} from './parser-utils.js';
import {fieldEvidence} from '../../core/evidence/field-evidence.js';

export function parseBankTransferDocument(text=''){
  const source=text.replace(/\r/g,'');
  const sender=textField(source,'sender',[/\b(?:ORDENANTE|EMISOR|DE)\s*:?\s*([^\n]+)/i],{confidence:.82,rule:'TRANSFER_PARTY_MATCH'});
  const receiver=textField(source,'receiver',[/\b(?:BENEFICIARIO|RECEPTOR|PARA)\s*:?\s*([^\n]+)/i],{confidence:.82,rule:'TRANSFER_PARTY_MATCH'});
  const senderBank=textField(source,'senderBank',[/BANCO\s+(?:EMISOR|ORDENANTE)\s*:?\s*([^\n]+)/i],{confidence:.9,rule:'BANK_MATCH'});
  const receiverBank=textField(source,'receiverBank',[/BANCO\s+(?:RECEPTOR|BENEFICIARIO)\s*:?\s*([^\n]+)/i],{confidence:.9,rule:'BANK_MATCH'});
  const trackingKey=textField(source,'trackingKey',[/CLAVE\s+DE\s+RASTREO\s*:?\s*([A-Z0-9\-]+)/i],{confidence:.98,rule:'TRACKING_KEY_MATCH'});
  const reference=textField(source,'reference',[/\bREFERENCIA\s*:?\s*([A-Z0-9\-]+)/i],{confidence:.92,rule:'REFERENCE_MATCH'});
  const amount=moneyField(source,'transferAmount',[/\b(?:IMPORTE|MONTO)\s*:?\s*\$?\s*([\d.,]+)/i],{confidence:.94});
  const accountRaw=textField(source,'account',[/\b(?:CUENTA|CLABE)\s*:?\s*([0-9 *Xx\-]{4,30})/i],{confidence:.88,rule:'ACCOUNT_MATCH'});
  const accountLast4=accountRaw.value!=null?fieldEvidence('accountLast4',lastDigits(accountRaw.value,4),{sourceText:accountRaw.sourceText,confidence:accountRaw.confidence,rule:'ACCOUNT_LAST4_DERIVED'}):fieldEvidence('accountLast4',null,{rule:'UNRESOLVED'});
  return {parserId:'bank-transfer-v1',fields:{sender,receiver,senderBank,receiverBank,trackingKey,reference,amount,accountLast4},checks:[]};
}
