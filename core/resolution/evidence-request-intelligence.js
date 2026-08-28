import {classifyWorldDomain,buildUniversalEvidenceStrategy} from '../world/universal-world-router.js';
export function analyzeEvidenceGaps({state={},problem={},observation={}}={}){
  const have=inventoryEvidence(state,observation),q=String(problem.userQuestion??'').toLowerCase();
  const domain=classifyWorldDomain({observation,problem});
  const strategy=buildUniversalEvidenceStrategy({domain:domain.primary,problem,state});
  const gaps=[];
  if(domain.primary!=='repair'){
    const universal=universalGaps({domain:domain.primary,strategy,state,observation,problem});
    return {schemaVersion:2,domain,strategy,have,gaps:universal};
  }
  const subjectKnown=have.identity||Boolean(state.subject?.label&&!/这个|那个|这里|那里/.test(state.subject.label));
  const troubleshooting=(problem.intentHypotheses??[]).some(x=>['troubleshoot','solve_or_guide'].includes(x.intent))||/坏|故障|问题|不工作|错误|error|falla|problema|怎么办|怎么修/i.test(q);
  if(!subjectKnown)gaps.push(gap('identity','high','需要先确认对象是什么','overview'));
  if(troubleshooting&&!have.model)gaps.push(gap('model','high','型号会显著缩小正确说明书、错误码和维修路径','nameplate'));
  if((/错误|代码|error|code|e\d+/i.test(q)||have.indicator)&&!have.errorCode)gaps.push(gap('error_code','high','错误代码通常比外观猜测更能直接定位故障','display'));
  if((/灯|闪|亮|indicator|light|parpade/i.test(q)||have.indicator)&&!have.indicatorDetail)gaps.push(gap('indicator_detail','medium','需要颜色、闪烁节奏和旁边符号来判断状态','indicator'));
  if((problem.referencedObjects??[]).some(x=>x.requiresVisualGrounding))gaps.push(gap('grounding','high','需要把“这里/那个”绑定到图片里的具体位置','closeup'));
  if(/接口|插口|线|连接|port|cable|conector/i.test(q)&&!have.connection)gaps.push(gap('connection','medium','需要看到接口和线缆连接关系','connection'));
  if(/裂|破|烧|漏|损坏|damage|broken|leak|quemad/i.test(q)&&!have.damageDetail)gaps.push(gap('damage_detail','high','需要局部细节判断损坏范围','closeup'));
  return {schemaVersion:2,domain,strategy,have,gaps:dedupe(gaps).sort((a,b)=>priority(b.priority)-priority(a.priority))};
}

export function directEvidenceRequest({analysis,state={}}={}){
  const g=analysis?.gaps?.[0];if(!g)return {complete:true,request:null};
  if(g.capture)return {complete:false,request:{gap:g,...g.capture}};
  const have=analysis.have??{};
  const map={
    identity:{title:'拍整体正面',instruction:'下一张请拍设备或物体的整体正面，让主体完整进入画面，先不要只拍局部。',why:g.reason,avoid:'如果整机已经拍清楚，就不用重复拍；优先找品牌或铭牌。'},
    model:{title:'拍铭牌/型号',instruction:'下一张请找设备背面、底部或侧面的铭牌，靠近拍清楚 BRAND、MODEL、SERIAL、VOLTAGE 等文字。',why:g.reason,avoid:have.errorCode?'错误代码已经有了，不需要重复拍屏幕。':'不要只拍整台机器，重点是让铭牌文字可读。'},
    error_code:{title:'拍错误代码',instruction:'下一张只拍显示屏或报错区域，让完整错误代码、图标和附近文字同时清楚可见。',why:g.reason,avoid:'不要离得太远；避免反光遮住数字或字母。'},
    indicator_detail:{title:'拍指示灯',instruction:'下一张请靠近拍闪灯位置，把灯的颜色、旁边图标/文字一起拍进去；如果能说出闪烁节奏，也请直接告诉我。',why:g.reason,avoid:'不要只描述“有个灯”，颜色和闪烁方式更重要。'},
    grounding:{title:'拍你说的这里',instruction:'下一张请把你说的“这里/那个位置”放在画面中央并拍近一点，同时保留少量周围结构作为定位参照。',why:g.reason,avoid:'不要完全裁掉周围环境，否则可能无法判断它属于哪个部位。'},
    connection:{title:'拍接口和线',instruction:'下一张请把接口、插头和线缆连接关系一起拍清楚，尽量能看到接口旁边的标签或符号。',why:g.reason,avoid:'不要拔插或改变连接后再拍；先记录当前真实状态。'},
    damage_detail:{title:'拍损坏部位',instruction:'下一张请拍损坏位置的近照，再补一张稍远的照片说明它位于整个物体的哪里。',why:g.reason,avoid:'如果涉及裸露电线、冒烟、泄漏或高温，不要为了拍照靠得更近。'},
  };
  return {complete:false,request:{gap:g,...(map[g.type]??{title:'补充证据',instruction:'请补拍当前缺失的关键信息。',why:g.reason,avoid:null})}};
}

export function evaluateEvidenceProgress(before,after){
  const old=new Set((before?.gaps??[]).map(x=>x.type)),now=new Set((after?.gaps??[]).map(x=>x.type));
  const resolved=[...old].filter(x=>!now.has(x)),remaining=[...now];
  return {resolved,remaining,improved:resolved.length>0,complete:remaining.length===0};
}


function universalGaps({domain,strategy,state,observation,problem}){
  const evidence=state?.evidence??[];
  const text=`${observation?.extractedText??''} ${evidence.map(x=>x.text??'').join(' ')}`;
  const hasVisual=(state?.activeEntitySummary?.photoCount??0)>0||evidence.some(x=>x.kind==='visual_identity');
  const out=[];
  const add=(req,priority='medium',reason='需要与当前问题匹配的补充证据')=>out.push({type:req.type,priority,reason,captureType:req.type,capture:{title:req.title,instruction:req.instruction,why:reason,avoid:safeAvoid(domain)}});
  const reqs=strategy?.requests??[];
  if(!hasVisual&&reqs[0])add(reqs[0],'high','先建立对象或场景的整体上下文');
  if(domain==='document'&&!/page|页|folio/i.test(text)&&reqs[0])add(reqs[0],'medium','完整页面能避免漏掉标题、页尾、签名或连续条款');
  if(domain==='finance'&&!/(total|importe|monto|amount|金额|referencia|reference|参考)/i.test(text)&&reqs[0])add(reqs[0],'high','需要完整凭证中的金额、日期、双方和参考信息');
  if(domain==='food'&&!/(ingred|配料|nutrition|营养|caduc|exp|fecha|日期)/i.test(text)&&reqs[1])add(reqs[1],'high','成分、过敏原和日期通常位于包装背面或侧面');
  if(domain==='plant'&&/黄|斑|虫|病|yellow|spot|pest|plaga/i.test(problem?.userQuestion??'')&&reqs[1])add(reqs[1],'high','叶片正反面更适合判断斑点、虫害和表面状态');
  if(domain==='animal'&&reqs[0])add(reqs[0],'high','识别陌生动物时优先保证安全距离和整体特征');
  if(domain==='product'&&!/(barcode|条码|model|modelo|型号|ingredient|配料)/i.test(text)&&reqs[1])add(reqs[1],'medium','标签或条码有助于确认具体商品版本');
  if(domain==='vehicle'&&/仪表|图标|警告灯|dashboard|warning/i.test(problem?.userQuestion??'')&&reqs[0])add(reqs[0],'medium','完整仪表或车辆位置上下文有助于判断图标含义及是否还有其他同时出现的提示');
  if(domain==='translation'&&String(observation?.extractedText??'').trim().length<8&&reqs[0])add(reqs[0],'high','需要清晰可读的原文才能可靠翻译');
  if(!out.length&&reqs[0]&&String(problem?.userQuestion??'').trim()&&domain==='general')add(reqs[0],'low','如果现有证据不足，可补充更完整的主体和环境');
  return dedupe(out).sort((a,b)=>priority(b.priority)-priority(a.priority));
}
function safeAvoid(domain){
 if(domain==='animal')return '不要触碰、捕捉或为了拍照靠近不熟悉的动物、昆虫。';
 if(domain==='vehicle')return '如果车辆正在道路中或存在交通风险，先保证人身安全，不要为了拍照停留在危险位置。';
 if(domain==='food')return '仅凭图片不能可靠判断所有食品安全风险；包装异常、异味或来源不明时不要冒险食用。';
 return null;
}

function inventoryEvidence(state,o){
 const evidence=state.evidence??[],ocr=[...evidence.filter(x=>x.kind==='ocr_text').map(x=>x.text),String(o.extractedText??'')].join(' ');
 const observed=evidence.filter(x=>x.kind==='visual_identity');
 const states=evidence.filter(x=>x.kind==='visual_state').map(x=>x.text).join(' ');
 return {
  identity:observed.length>0,
  model:/\b(model|modelo|mod\.?)\s*[:#-]?\s*[a-z0-9][a-z0-9._/-]{2,}/i.test(ocr),
  errorCode:/\b(?:err(?:or)?|error|code|c[oó]digo)?\s*[:#-]?\s*[a-z]\d{1,4}\b/i.test(ocr)||/\b(?:err|error)\s*[:#-]?\s*\d{1,5}\b/i.test(ocr),
  indicator:/indicator|light|led|灯|闪/i.test(states+' '+ocr),
  indicatorDetail:/(red|green|yellow|amber|blue|rojo|verde|amarillo|红|绿|黄).*(indicator|led|灯)|(?:indicator|led|灯).*(red|green|yellow|amber|blue|rojo|verde|amarillo|红|绿|黄)/i.test(states+' '+ocr),
  connection:evidence.some(x=>/connection|connector|port|cable/i.test(x.kind+' '+x.text)),
  damageDetail:evidence.some(x=>/damage|crack|broken|leak|burn/i.test(x.kind+' '+x.text)),
 };
}
function gap(type,priority,reason,captureType){return {type,priority,reason,captureType}}
function priority(x){return x==='high'?3:x==='medium'?2:1}
function dedupe(a){const s=new Set();return a.filter(x=>!s.has(x.type)&&(s.add(x.type),true))}
