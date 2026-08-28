function bool(v,fallback=false){if(v==null||v==='')return fallback;return /^(1|true|yes|on)$/i.test(String(v));}
function num(v,fallback){const n=Number(v);return Number.isFinite(n)?n:fallback;}

export function loadGatewayConfig(env=process.env){
  const port=num(env.SEEMIND_GATEWAY_PORT,8787),host=env.SEEMIND_GATEWAY_HOST||'127.0.0.1';
  const teachers=['A','B','C'].map(slot=>loadTeacher(slot,env)).filter(Boolean);
  return {
    host,port,maxBodyBytes:num(env.SEEMIND_GATEWAY_MAX_BODY,3_000_000),requestTimeoutMs:num(env.SEEMIND_GATEWAY_TIMEOUT_MS,45_000),
    teacherFailureThreshold:num(env.SEEMIND_TEACHER_FAILURE_THRESHOLD,2),teacherCooldownMs:num(env.SEEMIND_TEACHER_COOLDOWN_MS,30_000),
    allowOrigins:(env.SEEMIND_GATEWAY_ALLOW_ORIGINS||'http://localhost:5173,http://127.0.0.1:5173').split(',').map(x=>x.trim()).filter(Boolean),teachers,
    search:{enabled:bool(env.SEEMIND_SEARCH_ENABLED,false),endpoint:(env.SEEMIND_SEARCH_ENDPOINT||'').replace(/\/$/,''),apiKey:env.SEEMIND_SEARCH_API_KEY||'',publicName:env.SEEMIND_SEARCH_NAME||'search-provider',timeoutMs:num(env.SEEMIND_SEARCH_TIMEOUT_MS,15000)},
    ocr:{
      paddle:{
        enabled:bool(env.SEEMIND_PADDLE_OCR_ENABLED,false),
        endpoint:(env.SEEMIND_PADDLE_OCR_ENDPOINT||'http://127.0.0.1:8866').replace(/\/$/,''),
        timeoutMs:num(env.SEEMIND_PADDLE_OCR_TIMEOUT_MS,12000),
      }
    },
  };
}
function loadTeacher(slot,env){
  const prefix=`SEEMIND_TEACHER_${slot}_`;if(!bool(env[`${prefix}ENABLED`],false))return null;
  const endpoint=env[`${prefix}ENDPOINT`],model=env[`${prefix}MODEL`];if(!endpoint||!model)return null;
  return {id:`teacher-${slot.toLowerCase()}`,slot,protocol:env[`${prefix}PROTOCOL`]||'openai-compatible',endpoint:endpoint.replace(/\/$/,''),model,apiKey:env[`${prefix}API_KEY`]||'',
    capabilities:(env[`${prefix}CAPABILITIES`]||'reasoning,vision,structured_output').split(',').map(x=>x.trim()).filter(Boolean),
    languages:(env[`${prefix}LANGUAGES`]||'auto,zh-CN,es-MX,en').split(',').map(x=>x.trim()).filter(Boolean),reliability:num(env[`${prefix}RELIABILITY`],.7),evidenceScore:num(env[`${prefix}EVIDENCE_SCORE`],.7),freshnessScore:num(env[`${prefix}FRESHNESS_SCORE`],.5),latencyClass:env[`${prefix}LATENCY`]||'medium',costClass:env[`${prefix}COST`]||'medium'};
}
