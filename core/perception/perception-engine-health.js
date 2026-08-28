export class PerceptionEngineHealth{
 constructor({failureThreshold=3,cooldownMs=60000}={}){this.failureThreshold=failureThreshold;this.cooldownMs=cooldownMs;this.map=new Map()}
 get(id){return this.map.get(id)??{failures:0,circuitOpenUntil:0,lastErrorCode:null}}
 canUse(id,now=Date.now()){return Number(this.get(id).circuitOpenUntil??0)<=now}
 success(id){const p=this.get(id);this.map.set(id,{...p,failures:0,circuitOpenUntil:0,lastErrorCode:null,lastSuccessAt:Date.now()})}
 failure(id,errorCode='ENGINE_FAILED'){
   const p=this.get(id),failures=(p.failures??0)+1;
   this.map.set(id,{...p,failures,lastErrorCode:String(errorCode),lastFailureAt:Date.now(),circuitOpenUntil:failures>=this.failureThreshold?Date.now()+this.cooldownMs:0});
 }
 snapshot(){return Object.fromEntries(this.map)}
}
