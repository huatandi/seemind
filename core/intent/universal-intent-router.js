export const INTENTS=Object.freeze([
 'identify','explain','read','translate','understand','how_to_use','how_to_do','diagnose','solve',
 'compare','evaluate','safety','authenticity','find','learn','record','route_to_specialist','unknown'
]);

export function understandUniversalIntent({text='',observation={},worldDomain={}}={}){
 const q=String(text??'').trim();
 const scores={};
 hit(scores,'identify',q,/(这是什么|是什么东西|what is|qué es|que es|识别|identify)/i,.96);
 hit(scores,'explain',q,/(解释|讲解|explain|explica|介绍一下|介绍)/i,.9);
 hit(scores,'read',q,/(写了什么|上面写|读一下|read|qué dice|que dice|文字)/i,.88);
 hit(scores,'translate',q,/(翻译|translate|traduc)/i,.99);
 hit(scores,'understand',q,/(什么意思|meaning|significa|看不懂|理解)/i,.92);
 hit(scores,'how_to_use',q,/(怎么用|如何使用|how to use|cómo se usa|como se usa)/i,.96);
 hit(scores,'how_to_do',q,/(怎么做|如何做|how do i|cómo hago|como hago)/i,.9);
 hit(scores,'diagnose',q,/(为什么|原因|怎么回事|why|por qué|por que|故障原因)/i,.88);
 hit(scores,'solve',q,/(怎么办|解决|处理|修复|fix|solve|qué hago|que hago)/i,.94);
 hit(scores,'compare',q,/(哪个好|比较|区别|差别|compare|versus| vs |cuál es mejor|cual es mejor)/i,.96);
 hit(scores,'evaluate',q,/(好不好|值不值|怎么样|靠谱吗|worth|good|vale la pena)/i,.86);
 hit(scores,'safety',q,/(安全吗|危险吗|有毒|能不能吃|可以吃|能碰吗|safe|danger|toxic|seguro)/i,.98);
 hit(scores,'authenticity',q,/(真的假的|真假|正品|假货|authentic|fake|original|falso)/i,.95);
 hit(scores,'find',q,/(哪里(?:可以|能|可)?买|哪里找|去哪|找谁|链接|网址|where|find|dónde|donde|quién|quien)/i,.92);
 hit(scores,'learn',q,/(详细讲|科普|学习|教我|深入|learn|teach me|explícame a fondo)/i,.88);
 hit(scores,'record',q,/(提取|整理|记录|记账|保存|extract|organize|record|extrae)/i,.9);
 hit(scores,'route_to_specialist',q,/(哪个ai|哪个 ai|用什么ai|用什么 ai|找什么专家|交给谁|哪个工具|which ai|what ai|specialist|expert)/i,.98);

 if(!q){
   const detected=String(observation.detectedType??'');
   scores.identify=detected&&detected!=='unknown'?.55:.35;
   scores.explain=.45;
 }
 const ranked=Object.entries(scores).sort((a,b)=>b[1]-a[1]);
 const primary=ranked[0]?.[0]??'unknown';
 const intents=ranked.filter(([,v])=>v>=.72).map(([intent,confidence])=>({intent,confidence}));
 if(!intents.length&&primary!=='unknown')intents.push({intent:primary,confidence:ranked[0][1]});
 return {
   schemaVersion:1,
   primary,
   confidence:ranked[0]?.[1]??.25,
   intents,
   compound:intents.length>1,
   implicit:!q,
   userText:q,
   worldDomain:worldDomain.primary??'general',
 };
}

export function planIntentResponse({intentGraph={},worldDomain={},safetyRisk={}}={}){
 const order=['identify','read','translate','understand','explain','diagnose','compare','evaluate','authenticity','safety','how_to_use','how_to_do','solve','record','find','route_to_specialist','learn'];
 const active=new Set((intentGraph.intents??[]).map(x=>x.intent));
 const sequence=order.filter(x=>active.has(x));
 if(!sequence.length)sequence.push(intentGraph.primary==='unknown'?'explain':intentGraph.primary);
 return {
   schemaVersion:1,
   sequence,
   responseGoals:sequence.map(intent=>goalFor(intent)),
   shouldRouteExternally:sequence.some(x=>['find','route_to_specialist'].includes(x)),
   externalRouteReason:sequence.includes('route_to_specialist')?'user_requested_specialist':sequence.includes('find')?'user_requested_external_resource':null,
   safetyFirst:safetyRisk?.level==='R3',
   domain:worldDomain.primary??'general',
 };
}

function goalFor(i){
 const m={
  identify:'identify_what_is_visible',explain:'explain_in_plain_language',read:'extract_visible_text',
  translate:'translate_requested_content',understand:'explain_meaning_and_context',how_to_use:'give_safe_usage_guidance',
  how_to_do:'give_safe_steps',diagnose:'analyze_possible_causes_without_bluffing',solve:'offer_safe_solution_or_route_onward',
  compare:'compare_relevant_options',evaluate:'evaluate_with_explicit_criteria',safety:'assess_risk_before_action',
  authenticity:'assess_evidence_and_state_limits',find:'find_or_link_to_relevant_resource',learn:'teach_with_context',
  record:'extract_and_structure_information',route_to_specialist:'select_best_ai_tool_or_human_and_prepare_handoff',
  unknown:'proactively_explain_salient_content'
 };return m[i]??m.unknown;
}
function hit(scores,k,q,re,v){if(re.test(q))scores[k]=Math.max(scores[k]??0,v)}
