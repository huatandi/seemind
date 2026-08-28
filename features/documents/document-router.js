import {parseGasStationDocument} from './gas-station-parser.js';
import {parseCfdiDocument} from './cfdi-parser.js';
import {parseBankTransferDocument} from './bank-transfer-parser.js';
import {parseRestaurantDocument} from './restaurant-parser.js';

const SPECIALIZED={
  gas_station:parseGasStationDocument,
  cfdi_invoice:parseCfdiDocument,
  bank_transfer:parseBankTransferDocument,
  restaurant:parseRestaurantDocument,
};

export function routeSpecializedDocument({text='',receiptType={type:'unknown',confidence:0},baseReceipt=null}={}){
  const type=receiptType?.type??'unknown';
  const confidence=Number(receiptType?.confidence)||0;
  const parser=SPECIALIZED[type]??null;
  if(!parser||confidence<.7){
    return {
      schemaVersion:1,
      routed:false,
      documentType:type,
      confidence,
      parserId:null,
      reason:parser?'TYPE_CONFIDENCE_TOO_LOW':'NO_SPECIALIZED_PARSER',
      fields:{},
      checks:[],
    };
  }
  const result=parser(String(text??''),{baseReceipt});
  return {
    schemaVersion:1,
    routed:true,
    documentType:type,
    confidence,
    parserId:result.parserId,
    fields:result.fields??{},
    checks:result.checks??[],
    notes:result.notes??[],
  };
}
