import {HttpGatewayTeacherProvider} from './http-gateway-teacher.js';
export async function discoverGatewayTeachers(gatewayUrl,{fetchImpl=globalThis.fetch}={}){
  const base=String(gatewayUrl||'').replace(/\/$/,'');if(!base)return [];
  const response=await fetchImpl(`${base}/v1/teachers`,{headers:{accept:'application/json'}});if(!response.ok)throw new Error(`Gateway discovery HTTP ${response.status}`);const data=await response.json();
  return (data.teachers||[]).filter(t=>t.health?.status!=='circuit_open').map(t=>new HttpGatewayTeacherProvider({id:t.id,gatewayUrl:base,fetchImpl,profile:{provider:'gateway',model:t.model,capabilities:t.capabilities||[],supportedLanguages:t.languages||['auto'],supportedModalities:(t.capabilities||[]).includes('vision')?['text','image']:['text'],supportsImages:(t.capabilities||[]).includes('vision'),supportsStructuredOutput:true,supportsCitations:true,privacyModes:['cloud'],latencyClass:t.latencyClass||'medium',costClass:t.costClass||'medium',reliabilityScore:t.reliability??.5,evidenceScore:t.evidenceScore??.5,freshnessScore:t.freshnessScore??.5,historicalSuccess:t.reliability??.5}}));
}
export function gatewayUrlFromLocation(locationLike=globalThis.location){try{return new URLSearchParams(locationLike?.search||'').get('gateway')||'';}catch{return '';}}
