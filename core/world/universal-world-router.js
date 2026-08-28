export const WORLD_DOMAINS=Object.freeze([
 'general','document','product','food','plant','animal','vehicle','place','nature','finance','translation','repair','safety','unknown'
]);

export function classifyWorldDomain({observation={},problem={}}={}){
 const text=`${problem.userQuestion??''} ${observation.extractedText??''}`.toLowerCase();
 const detected=String(observation.detectedType??'').toLowerCase();
 const identities=(observation.observations??[]).filter(x=>x.kind==='general_vision').flatMap(x=>x.identity??[]).map(x=>String(x.label).toLowerCase()).join(' ');
 const all=`${text} ${detected} ${identities}`;
 const scores={general:.2};
 add(scores,'document',/(document|receipt|invoice|ticket|contract|form|factura|recibo|合同|文件|小票|票据|表格)/i.test(all),.9);
 add(scores,'finance',/(bank|transfer|payment|bbva|banorte|santander|银行|转账|付款|收款|金额)/i.test(all),.88);
 add(scores,'food',/(food|ingredient|nutrition|expiry|comida|ingrediente|alimento|食品|配料|营养|保质期)/i.test(all),.88);
 add(scores,'plant',/(plant|leaf|flower|tree|planta|hoja|植物|叶|花|树)/i.test(all),.9);
 add(scores,'animal',/(animal|dog|cat|bird|insect|spider|perro|gato|insecto|动物|狗|猫|鸟|昆虫|蜘蛛)/i.test(all),.9);
 add(scores,'vehicle',/(vehicle|car|dashboard|tire|vin|coche|auto|vehiculo|汽车|车辆|仪表盘|轮胎)/i.test(all),.9);
 add(scores,'product',/(product|barcode|package|label|producto|商品|包装|条码|标签)/i.test(all),.75);
 add(scores,'place',/(building|landmark|street|place|edificio|lugar|建筑|景点|街道|地点)/i.test(all),.72);
 add(scores,'translation',/(translate|translation|traduc|翻译)/i.test(all),.98);
 add(scores,'repair',/(repair|repar|故障|维修|坏了|不工作|报错|error code|错误代码|接口.*(?:线|连接)|(?:线|连接).*接口|红灯.*闪|指示灯.*闪)/i.test(all),.7);
 add(scores,'safety',/(danger|hazard|smoke|fire|leak|poison|危险|冒烟|着火|泄漏|有毒)/i.test(all),.95);
 const ranked=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
 const active=ranked.filter(([domain,confidence])=>domain!=='general'&&confidence>=.7).map(([domain,confidence])=>({domain,confidence}));
 if(!active.length)active.push({domain:ranked[0][0],confidence:ranked[0][1]});
 return {schemaVersion:2,primary:ranked[0][0],confidence:ranked[0][1],secondary:ranked.slice(1,4).map(([domain,confidence])=>({domain,confidence})),active,scores};
}

export function buildUniversalEvidenceStrategy({domain='general',problem={},state={}}={}){
 const q=String(problem.userQuestion??'');
 const strategies={
  document:[
   ['document_page','拍完整页面','请把整页拍完整，四个角尽量都进入画面，避免裁掉页首、页尾或签名区域。'],
   ['continuation_page','拍下一页','如果文字或条款在当前页面没有结束，请继续拍下一页，并保持页码可见。'],
  ],
  finance:[
   ['transaction_core','拍完整凭证','请把完整转账/付款凭证拍清楚，优先保留金额、日期、付款方、收款方、银行和参考号。'],
  ],
  food:[
   ['food_front','拍包装正面','请先拍包装正面，确认食品名称、品牌和规格。'],
   ['ingredients','拍配料/日期','如果你关心成分、过敏原或是否过期，请再拍配料表、营养表和日期区域。'],
  ],
  plant:[
   ['plant_overview','拍整株','请先拍整株，保留叶片分布、茎和整体状态。'],
   ['leaf_detail','拍叶片正反面','如果你关心黄叶、斑点或虫害，请补拍异常叶片正面和背面。'],
  ],
  animal:[
   ['animal_overview','保持距离拍整体','请在安全距离拍清整体外形和主要花纹；不要为了识别而触碰或靠近陌生动物/昆虫。'],
   ['animal_detail','补拍关键特征','如果安全可行，再拍背部花纹、翅、足或头部等关键特征。'],
  ],
  vehicle:[
   ['vehicle_context','拍车辆/区域整体','请先拍车辆或相关区域的整体，确认问题发生在哪个位置。'],
   ['vehicle_detail','拍相关局部','再拍你关心的仪表灯、轮胎、标签或损坏位置，并保留周围少量定位参照。'],
  ],
  product:[
   ['product_front','拍商品正面','请拍商品包装正面，保留品牌、名称和规格。'],
   ['product_label','拍标签/条码','如果要确认型号、成分或具体版本，请再拍背面标签或条形码。'],
  ],
  place:[
   ['place_context','拍整体环境','请拍更完整的建筑、设施或周围环境，让我能利用结构、标识和场景判断它是什么。'],
  ],
  translation:[
   ['text_region','拍清文字','请让需要翻译的文字正对镜头、清晰可读；如果内容很长，可以按页面顺序连续拍。'],
  ],
  repair:[
   ['repair_context','拍整体与异常位置','先拍对象整体，再拍异常位置；只有确实涉及设备诊断时，我才会继续索取型号、错误代码等维修证据。'],
  ],
  general:[
   ['general_overview','拍完整主体','请让你想了解的主体完整进入画面，并保留少量周围环境。'],
   ['general_detail','补拍关键细节','如果你关心某个局部，请再拍近一点，并用语音告诉我你具体想知道什么。'],
  ],
 };
 const selected=strategies[domain]??strategies.general;
 return {schemaVersion:1,domain,goal:inferGoal(q),requests:selected.map(([type,title,instruction])=>({type,title,instruction})),repairSpecific:domain==='repair'};
}

function inferGoal(q){
 if(/是什么|what is|que es|qué es/i.test(q))return 'identify';
 if(/翻译|translate|traduc/i.test(q))return 'translate';
 if(/怎么办|如何|how|como|cómo/i.test(q))return 'act';
 return 'understand';
}
function add(scores,k,ok,v){if(ok)scores[k]=Math.max(scores[k]??0,v)}
