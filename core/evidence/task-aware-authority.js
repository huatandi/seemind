/**
 * Task-aware evidence authority.
 * Scores which evidence kind is naturally authoritative for a claim.
 * It does NOT route providers, resolve conflicts, or produce answers.
 */
const RULES={
  barcode:{barcode:1,official:.94,retailer:.78,ocr:.62,vision:.35,teacher:.55,web:.5,community:.25},
  product_identity:{barcode:1,official:.95,ocr:.86,professional_database:.84,teacher:.72,vision:.68,retailer:.66,web:.52,community:.3},
  model:{barcode:.96,official:.95,ocr:.9,professional_database:.82,teacher:.74,vision:.62,retailer:.6,web:.5,community:.28},
  size:{ocr:.94,barcode:.9,official:.9,professional_database:.82,teacher:.7,vision:.58,retailer:.58,web:.48,community:.25},
  variant:{barcode:.94,ocr:.9,official:.9,teacher:.74,vision:.7,professional_database:.7,retailer:.6,web:.48,community:.25},
  color:{pixel:.96,vision:.9,ocr:.48,teacher:.78,official:.65,web:.45,community:.25},
  text:{ocr:.98,teacher:.82,vision:.55,official:.5,web:.4,community:.2},
  receipt_total:{ocr:.92,arithmetic:.98,user:.95,teacher:.72,vision:.42,web:.1,community:.05},
  current_price:{retailer:.96,official:.88,web:.72,teacher:.62,community:.42,ocr:.35,vision:.2},
  current_availability:{retailer:.98,official:.86,web:.7,teacher:.58,community:.35},
  law:{government:1,official:.92,professional_database:.78,teacher:.7,web:.52,community:.18},
  safety:{government:.98,official:.9,professional_database:.86,teacher:.72,web:.5,community:.2},
  manual:{official:1,professional_database:.82,teacher:.72,web:.56,community:.34,vision:.3},
};

export function evidenceAuthorityForClaim(evidence={},claim={},task={}){
  const claimClass=classifyClaim(claim,task);
  const kind=normalizeKind(evidence);
  const table=RULES[claimClass]??{};
  const authority=clamp(table[kind]??defaultAuthority(kind));
  return {schemaVersion:1,claimClass,evidenceKind:kind,authority,tier:tier(authority),policy:{taskAware:true,teacherIsNotDefaultAuthority:true,noUniversalEvidenceWinner:true}};
}

export function rankEvidenceAuthority(evidence=[],claim={},task={}){
  return evidence.map(e=>({...e,taskAuthority:evidenceAuthorityForClaim(e,claim,task)}))
    .sort((a,b)=>b.taskAuthority.authority-a.taskAuthority.authority);
}

export function classifyClaim(claim={},task={}){
  const field=String(claim.field??claim.claimKey??'').toLowerCase();
  const hay=`${field} ${task.type??''} ${task.userIntent??''}`.toLowerCase();
  if(/barcode|gtin|ean|upc/.test(hay))return 'barcode';
  if(/receipt.*total|total.*receipt|subtotal|importe|金额|总额/.test(hay))return 'receipt_total';
  if(/current.*price|price|shopping|多少钱|价格|哪里买/.test(hay))return 'current_price';
  if(/availability|stock|in stock|库存|有货/.test(hay))return 'current_availability';
  if(/law|legal|regulation|法规|法律|规定|移民|税/.test(hay))return 'law';
  if(/medical|health|safety|医疗|健康|安全/.test(hay))return 'safety';
  if(/manual|compatib|说明书|兼容/.test(hay))return 'manual';
  if(/model|型号/.test(field))return 'model';
  if(/size|capacity|容量|规格/.test(field))return 'size';
  if(/variant|flavor|sabor|款式|口味/.test(field))return 'variant';
  if(/color|颜色/.test(field))return 'color';
  if(/text|ocr|文字/.test(field))return 'text';
  if(/brand|product|identity|商品|品牌/.test(hay))return 'product_identity';
  return 'generic';
}

function normalizeKind(e){
  const raw=String(e.evidenceKind??e.sourceType??e.source??e.kind??'').toLowerCase();
  if(/barcode|gtin|ean|upc/.test(raw))return 'barcode';
  if(/ocr/.test(raw))return 'ocr';
  if(/pixel|color/.test(raw))return 'pixel';
  if(/vision|visual/.test(raw))return 'vision';
  if(/arith|math/.test(raw))return 'arithmetic';
  if(/government|gobierno/.test(raw))return 'government';
  if(/official|manufacturer|fabricante/.test(raw))return 'official';
  if(/professional|database/.test(raw))return 'professional_database';
  if(/retailer|store|shop/.test(raw))return 'retailer';
  if(/teacher|llm|ai/.test(raw))return 'teacher';
  if(/community|reddit|forum/.test(raw))return 'community';
  if(/user/.test(raw))return 'user';
  return raw||'web';
}
function defaultAuthority(k){return {government:.9,official:.86,professional_database:.78,barcode:.82,ocr:.72,pixel:.72,vision:.66,teacher:.66,retailer:.64,user:.6,web:.5,community:.3}[k]??.45}
function tier(x){return x>=.9?'decisive':x>=.78?'strong':x>=.6?'supporting':'weak'}
function clamp(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0}
