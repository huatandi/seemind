export function extractSpeechEvidence(text='',{language='auto'}={}){
  const raw=String(text??'').trim();
  const evidence={
    schemaVersion:1,
    modality:'speech',
    rawText:raw,
    language,
    intentSignals:[],
    symptoms:[],
    temporal:[],
    attemptedActions:[],
    references:[],
    constraints:[],
    uncertainSegments:[],
  };
  if(!raw)return evidence;

  collect(evidence.intentSignals,raw,[
    [/怎么办|怎么修|怎么处理|如何解决|how do i|how to|cómo|como .*solucion|qué hago|que hago/i,'solve_or_guide'],
    [/为什么|怎么回事|what happened|why|por qué|por que/i,'explain_cause'],
    [/是什么|这是什么|what is|qué es|que es/i,'identify'],
    [/翻译|translate|traduc/i,'translate'],
  ]);
  collect(evidence.symptoms,raw,[
    [/不工作|不能用|没反应|坏了|故障|error|falla|no funciona/i,'not_working'],
    [/闪|闪烁|parpade|blinking|flashing/i,'blinking_indicator'],
    [/响|噪音|声音|noise|ruido|sonido/i,'abnormal_sound'],
    [/漏油|漏水|泄漏|leak|fuga/i,'leak'],
    [/发热|过热|很烫|overheat|caliente/i,'overheating'],
  ]);
  collect(evidence.temporal,raw,[
    [/昨天[^，。,.!?]*/i,'yesterday_context'],
    [/今天[^，。,.!?]*/i,'today_context'],
    [/刚才[^，。,.!?]*/i,'recent_context'],
    [/一直[^，。,.!?]*/i,'persistent'],
    [/突然[^，。,.!?]*/i,'sudden_change'],
  ]);
  collect(evidence.attemptedActions,raw,[
    [/拔(?:过)?(?:一次)?插头|拔掉.*插头|重新插|断电.*重启|重启(?:过)?/i,'power_cycle'],
    [/换(?:过)?电池|更换(?:过)?电池/i,'battery_replaced'],
    [/清理(?:过)?|清洁(?:过)?/i,'cleaned'],
    [/重新安装|重装(?:过)?/i,'reinstalled'],
  ]);
  collect(evidence.references,raw,[
    [/(这个|这个东西|这个机器|这个设备)/i,'this_object'],
    [/(这里|这边|这个地方)/i,'this_region'],
    [/(那里|那边|那个地方)/i,'that_region'],
    [/(右边|右侧)/i,'right_side'],
    [/(左边|左侧)/i,'left_side'],
    [/(上面|上边)/i,'upper_area'],
    [/(下面|下边)/i,'lower_area'],
    [/(红灯|红色灯)/i,'red_indicator'],
    [/(绿灯|绿色灯)/i,'green_indicator'],
    [/(这个数字|这个代码|错误码|故障码)/i,'displayed_code'],
    [/(这两个|两个)/i,'two_objects'],
    [/(第一个|第1个|first(?: one)?|primero|primera)/i,'ordinal_1'],
    [/(第二个|第2个|second(?: one)?|segundo|segunda)/i,'ordinal_2'],
    [/(第三个|第3个|third(?: one)?|tercero|tercera)/i,'ordinal_3'],
  ]);
  if(/没听清|听不清|不确定|好像|可能|大概|记不清|什么来着/i.test(raw)){
    evidence.uncertainSegments.push({text:raw,reason:'speaker_uncertainty'});
  }
  return evidence;
}

function collect(out,text,patterns){
  for(const [re,type] of patterns){
    const m=text.match(re);
    if(m)out.push({type,sourceText:m[0],confidence:.9});
  }
}
