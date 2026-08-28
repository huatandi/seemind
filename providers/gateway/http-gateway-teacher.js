import {TeacherProvider} from '../../core/teacher/teacher-provider.js';
import {createGatewayRequest,validateGatewayResponse} from '../../core/gateway/gateway-contract.js';

export class HttpGatewayTeacherProvider extends TeacherProvider{
  constructor({id,gatewayUrl,profile={},fetchImpl=globalThis.fetch}={}){super(id,{...profile,provider:profile.provider??'gateway'});if(!gatewayUrl)throw new Error('gatewayUrl required');this.gatewayUrl=String(gatewayUrl).replace(/\/$/,'');this.fetchImpl=fetchImpl;}
  async healthCheck(){
    try{const r=await this.fetchImpl(`${this.gatewayUrl}/v1/teachers/${encodeURIComponent(this.id)}/health`,{headers:{accept:'application/json'}});if(!r.ok)return {status:r.status===404?'down':'degraded',httpStatus:r.status};const data=await r.json();const status=data?.health?.status;return {status:['ready','half_open'].includes(status)?'ready':status==='degraded'?'degraded':'down',detail:status};}catch{return {status:'down'}}
  }
  async execute(taskPackage){
    const request=createGatewayRequest({providerId:this.id,model:this.profile.model,taskPackage});
    const r=await this.fetchImpl(`${this.gatewayUrl}/v1/teacher/execute`,{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify(request)});
    if(!r.ok)throw new Error(`Gateway HTTP ${r.status}`);const raw=await r.json();const checked=validateGatewayResponse(raw,request.requestId);if(!checked.ok)throw new Error(`Invalid gateway response: ${checked.issues.join(',')}`);return checked.result;
  }
}
