import {factFromField,createFact} from './fact.js';

export function buildUniversalStructuredFacts(receipt={},context={}){
  const currency=String(context.currency??receipt.currency?.value??receipt.currency??'XXX').toUpperCase();
  const MONEY_UNIT=`${currency}-minor`;

  const docType=receipt?.receiptType?.type??'unknown';
  const specialized=receipt?.specialized??{};
  const parserId=specialized?.parserId??'receipt-parser';
  const merchantIdentity=receipt?.intelligence?.merchantIdentity??{};

  const facts=[];

  // Identity
  pushField(facts,receipt.merchant,{id:'identity.merchant',category:'identity',name:'merchant',documentType:docType});
  if(merchantIdentity.brand?.value)facts.push(createFact({
    id:'identity.brand',category:'identity',name:'brand',value:merchantIdentity.brand.value,
    confidence:merchantIdentity.brand.confidence??0,
    evidence:[{sourceText:merchantIdentity.brand.sourceText??'',rule:'MERCHANT_IDENTITY_BRAND'}],
    provenance:{source:'local',parserId:'merchant-intelligence',documentType:docType},
  }));
  if(merchantIdentity.legalEntity?.value)facts.push(createFact({
    id:'identity.legalEntity',category:'identity',name:'legalEntity',value:merchantIdentity.legalEntity.value,
    confidence:merchantIdentity.legalEntity.confidence??0,
    evidence:[{sourceText:merchantIdentity.legalEntity.sourceText??'',rule:'MERCHANT_IDENTITY_LEGAL'}],
    provenance:{source:'local',parserId:'merchant-intelligence',documentType:docType},
  }));

  // Time
  pushField(facts,receipt.date,{id:'time.date',category:'time',name:'date',documentType:docType});

  // Money
  for(const [key,name] of [['subtotal','subtotal'],['tax','tax'],['discount','discount'],['total','total'],['cash','cash'],['change','change']]){
    pushField(facts,receipt[key],{id:`money.${name}`,category:'money',name,unit:MONEY_UNIT,documentType:docType});
  }

  // Specialized categories.
  const fields=specialized?.fields??{};
  if(docType==='bank_transfer'){
    pushField(facts,fields.sender,{id:'parties.sender',category:'parties',name:'sender',parserId,documentType:docType});
    pushField(facts,fields.receiver,{id:'parties.receiver',category:'parties',name:'receiver',parserId,documentType:docType});
    pushField(facts,fields.senderBank,{id:'banking.senderBank',category:'banking',name:'senderBank',parserId,documentType:docType});
    pushField(facts,fields.receiverBank,{id:'banking.receiverBank',category:'banking',name:'receiverBank',parserId,documentType:docType});
    pushField(facts,fields.accountLast4,{id:'banking.accountLast4',category:'banking',name:'accountLast4',parserId,documentType:docType});
    pushField(facts,fields.reference,{id:'banking.reference',category:'banking',name:'reference',parserId,documentType:docType});
    pushField(facts,fields.trackingKey,{id:'banking.trackingKey',category:'banking',name:'trackingKey',parserId,documentType:docType});
    pushField(facts,fields.amount,{id:'money.transferAmount',category:'money',name:'transferAmount',unit:MONEY_UNIT,parserId,documentType:docType});
  }

  if(docType==='cfdi_invoice'){
    pushField(facts,fields.issuerRfc,{id:'fiscal.issuerRfc',category:'fiscal',name:'issuerRfc',parserId,documentType:docType});
    pushField(facts,fields.receiverRfc,{id:'fiscal.receiverRfc',category:'fiscal',name:'receiverRfc',parserId,documentType:docType});
    pushField(facts,fields.uuid,{id:'fiscal.uuid',category:'fiscal',name:'uuid',parserId,documentType:docType});
    pushField(facts,fields.fiscalRegime,{id:'fiscal.regime',category:'fiscal',name:'fiscalRegime',parserId,documentType:docType});
    pushField(facts,fields.cfdiUse,{id:'fiscal.cfdiUse',category:'fiscal',name:'cfdiUse',parserId,documentType:docType});
  }

  if(docType==='gas_station'){
    pushField(facts,fields.stationName,{id:'domain.stationName',category:'domain',name:'stationName',parserId,documentType:docType});
    pushField(facts,fields.crePermit,{id:'domain.crePermit',category:'domain',name:'crePermit',parserId,documentType:docType});
    pushField(facts,fields.fuelProduct,{id:'domain.fuelProduct',category:'domain',name:'fuelProduct',parserId,documentType:docType});
    pushField(facts,fields.liters,{id:'domain.liters',category:'domain',name:'liters',unit:'L',parserId,documentType:docType});
    pushField(facts,fields.pricePerLiter,{id:'domain.pricePerLiter',category:'domain',name:'pricePerLiter',unit:MONEY_UNIT,parserId,documentType:docType});
  }

  if(docType==='restaurant'){
    pushField(facts,fields.tip,{id:'domain.tip',category:'domain',name:'tip',unit:MONEY_UNIT,parserId,documentType:docType});
    pushField(facts,fields.table,{id:'domain.table',category:'domain',name:'table',parserId,documentType:docType});
    pushField(facts,fields.server,{id:'domain.server',category:'domain',name:'server',parserId,documentType:docType});
    pushField(facts,fields.guests,{id:'domain.guests',category:'domain',name:'guests',unit:'count',parserId,documentType:docType});
  }

  attachConflicts(facts,receipt.checks??[]);
  attachConflicts(facts,specialized.checks??[]);

  const resolved=facts.filter(x=>x.status==='resolved'&&x.value!=null);
  const conflicted=facts.filter(x=>x.conflicts.length>0);
  return {
    schemaVersion:1,
    documentType:{value:docType,confidence:receipt?.receiptType?.confidence??0,evidence:receipt?.receiptType?.evidence??[]},
    facts,
    index:Object.fromEntries(facts.map(f=>[f.id,f])),
    summary:{
      totalFacts:facts.length,
      resolvedFacts:resolved.length,
      unresolvedFacts:facts.length-resolved.length,
      conflictedFacts:conflicted.length,
    },
    policy:{
      factsOnly:true,
      noAccountingClassification:true,
      noIncomeExpenseInference:true,
      noAutoPosting:true,
      unresolvedMayRemainUnresolved:true,
    },
  };
}

function pushField(out,field,opts){
  if(!field)return;
  out.push(factFromField(field,opts));
}
function attachConflicts(facts,checks){
  for(const check of checks??[]){
    if(check?.status!=='conflicted')continue;
    for(const id of checkFactIds(check.id)){
      const fact=facts.find(x=>x.id===id);
      if(fact)fact.conflicts.push({
        id:check.id,status:check.status,
        expectedMinor:Number.isFinite(Number(check.expectedMinor))?Number(check.expectedMinor):null,
        actualMinor:Number.isFinite(Number(check.actualMinor))?Number(check.actualMinor):null,
        deltaMinor:Number.isFinite(Number(check.deltaMinor))?Number(check.deltaMinor):null,
      });
    }
  }
}
function checkFactIds(id){
  if(id==='cash-change-total')return ['money.cash','money.change','money.total'];
  if(id==='subtotal-tax-total')return ['money.subtotal','money.tax','money.discount','money.total'];
  if(id==='subtotal-iva-rate-tax')return ['money.subtotal','money.tax'];
  return [];
}
