export class GatewayTeacherManager{
  constructor({registry,failureThreshold=2,cooldownMs=30_000,clock=()=>Date.now()}={}){
    this.registry=registry;this.failureThreshold=Math.max(1,Number(failureThreshold)||2);this.cooldownMs=Math.max(1000,Number(cooldownMs)||30_000);this.clock=clock;this.states=new Map();
  }
  state(id){
    if(!this.registry.get(id))return null;
    const s=this.states.get(id)??{status:'ready',consecutiveFailures:0,lastSuccessAt:null,lastFailureAt:null,circuitOpenedAt:null,lastError:null,attempts:0,successes:0,totalLatencyMs:0};
    if(s.status==='circuit_open'&&this.clock()-s.circuitOpenedAt>=this.cooldownMs){s.status='half_open';}
    this.states.set(id,s);return {...s};
  }
  canExecute(id){const s=this.state(id);return Boolean(s)&&s.status!=='circuit_open';}
  recordSuccess(id,{latencyMs=0}={}){const s=this.states.get(id)??{attempts:0,successes:0,totalLatencyMs:0};this.states.set(id,{...s,status:'ready',consecutiveFailures:0,lastSuccessAt:this.clock(),circuitOpenedAt:null,lastError:null,attempts:(s.attempts??0)+1,successes:(s.successes??0)+1,totalLatencyMs:(s.totalLatencyMs??0)+(Number(latencyMs)||0)});}
  recordFailure(id,error,{latencyMs=0}={}){const prev=this.states.get(id)??{consecutiveFailures:0,attempts:0,successes:0,totalLatencyMs:0};const failures=(prev.consecutiveFailures??0)+1;const open=failures>=this.failureThreshold;this.states.set(id,{...prev,status:open?'circuit_open':'degraded',consecutiveFailures:failures,lastFailureAt:this.clock(),circuitOpenedAt:open?this.clock():prev.circuitOpenedAt??null,lastError:safeError(error),attempts:(prev.attempts??0)+1,totalLatencyMs:(prev.totalLatencyMs??0)+(Number(latencyMs)||0)});}
  publicState(id){const s=this.state(id);if(!s)return null;const {lastError,...pub}=s;return {...pub,successRate:pub.attempts?pub.successes/pub.attempts:null,avgLatencyMs:pub.attempts?Math.round(pub.totalLatencyMs/pub.attempts):null};}
}
function safeError(error){return String(error?.code||error?.message||'upstream_failure').slice(0,120);}
