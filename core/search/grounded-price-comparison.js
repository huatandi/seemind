export function compareGroundedOffers({identity,offers=[],now=new Date().toISOString()}={}){
  const target=identity?.identity??identity??{};
  const exactReady=Boolean(identity?.status==='exact_candidate'||identity?.exact===true);
  if(!exactReady)return result('blocked_identity',[],[],['EXACT_IDENTITY_REQUIRED']);
  const accepted=[],rejected=[];
  for(const raw of offers){
    const offer=normalizeOffer(raw,now);
    const match=matchOfferIdentity(target,offer.product??{});
    if(!match.ok){rejected.push({...offer,identityMatch:match});continue}
    if(offer.availability==='out_of_stock'){rejected.push({...offer,identityMatch:match,rejectReason:'OUT_OF_STOCK'});continue}
    if(!Number.isFinite(offer.price)){rejected.push({...offer,identityMatch:match,rejectReason:'PRICE_MISSING'});continue}
    accepted.push({...offer,identityMatch:match,totalCost:round(offer.price+(offer.shipping??0)),unitPrice:unitPrice(offer)});
  }
  accepted.sort((a,b)=>(a.totalCost-b.totalCost)||(freshnessRank(b)-freshnessRank(a)));
  const warnings=[];
  if(accepted.some(x=>x.memberOnly))warnings.push('MEMBER_PRICE_PRESENT');
  if(accepted.some(x=>x.promoEndsAt))warnings.push('TIME_LIMITED_PROMOTION_PRESENT');
  if(accepted.some(x=>x.shipping==null&&x.channel==='online'))warnings.push('ONLINE_SHIPPING_UNKNOWN');
  return {schemaVersion:1,status:accepted.length?'ready':'no_comparable_offers',identity:target,accepted,rejected,best:accepted[0]??null,warnings,
    policy:{sameProductOnly:true,outOfStockCannotWin:true,totalCostPreferred:true,unitPriceIsSecondary:true,searchCannotRedefineIdentity:true}};
}

export function matchOfferIdentity(target={},candidate={}){
  const reasons=[];let score=0,weight=0;
  if(target.barcode){weight+=5;if(candidate.barcode&&canon(candidate.barcode)===canon(target.barcode))score+=5;else if(candidate.barcode)reasons.push('BARCODE_MISMATCH');}
  for(const [field,w] of [['model',3],['size',2],['variant',2],['brand',1]]){
    if(!target[field])continue;weight+=w;
    if(candidate[field]&&canon(candidate[field])===canon(target[field]))score+=w;
    else if(candidate[field])reasons.push(`${field.toUpperCase()}_MISMATCH`);
  }
  const hard=reasons.some(x=>['BARCODE_MISMATCH','MODEL_MISMATCH','SIZE_MISMATCH','VARIANT_MISMATCH'].includes(x));
  const confidence=weight?score/weight:0;
  return {ok:!hard&&confidence>=.55,confidence:round(confidence),reasons};
}

function normalizeOffer(o,now){
  const price=num(o.price??o.claimValue);const shipping=numNullable(o.shipping);
  return {id:o.id??null,title:o.title??'',url:o.url??'',seller:o.seller??o.publisher??null,channel:o.channel??inferChannel(o),
    price,currency:o.currency??inferCurrency(o.claimKey)??null,shipping,availability:o.availability??'unknown',memberOnly:Boolean(o.memberOnly),
    promoEndsAt:o.promoEndsAt??null,distanceKm:numNullable(o.distanceKm),observedAt:o.observedAt??o.accessedAt??now,
    product:{barcode:o.product?.barcode??o.barcode??null,brand:o.product?.brand??o.brand??null,model:o.product?.model??o.model??null,size:o.product?.size??o.size??null,variant:o.product?.variant??o.variant??null},
    quantity:numNullable(o.quantity),unit:o.unit??null};
}
function unitPrice(o){return Number.isFinite(o.quantity)&&o.quantity>0?round(o.totalCost/o.quantity):null}
function inferChannel(o){return Number.isFinite(Number(o.distanceKm))?'physical':'online'}
function inferCurrency(k=''){const m=String(k).match(/price_([a-z]{3})/i);return m?.[1]?.toUpperCase()??null}
function freshnessRank(o){const t=Date.parse(o.observedAt);return Number.isFinite(t)?t:0}
function num(v){const n=Number(v);return Number.isFinite(n)?n:NaN}
function numNullable(v){if(v==null||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null}
function canon(v){return String(v??'').toLowerCase().replace(/[^a-z0-9áéíóúñ]+/g,'')}
function round(n){return Math.round(n*100)/100}
function result(status,accepted,rejected,warnings){return {schemaVersion:1,status,accepted,rejected,best:null,warnings,policy:{sameProductOnly:true,searchCannotRedefineIdentity:true}}}
