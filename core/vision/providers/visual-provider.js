export class VisualProvider {
  constructor(id,{version='unknown',providerType='local',capabilities=[],priority=50,deviceClasses=['low_power','balanced','performance'],estimatedMemoryMb=0,estimatedLatencyMs=3000,privacyModes=['local'],reliability=.5}={}){
    this.id=String(id);this.version=String(version);this.providerType=String(providerType);
    this.capabilities=normalizeCapabilities(capabilities);this.priority=Number(priority)||50;
    this.deviceClasses=[...deviceClasses];this.estimatedMemoryMb=Number(estimatedMemoryMb)||0;
    this.estimatedLatencyMs=Number(estimatedLatencyMs)||0;this.privacyModes=[...privacyModes];
    this.reliability=clamp01(reliability);
  }
  async analyze(_image,_request={}){throw new Error('VisualProvider.analyze must be implemented')}
  async healthCheck(){return {status:'ready'}}
  getProfile(){return {
    id:this.id,version:this.version,providerType:this.providerType,capabilities:this.capabilities.map(x=>({...x})),
    priority:this.priority,deviceClasses:[...this.deviceClasses],estimatedMemoryMb:this.estimatedMemoryMb,
    estimatedLatencyMs:this.estimatedLatencyMs,privacyModes:[...this.privacyModes],reliability:this.reliability,
  }}
}
function normalizeCapabilities(caps){return caps.map(x=>typeof x==='string'?{capability:x,score:1}:{capability:String(x.capability),score:clamp01(x.score??1)})}
function clamp01(n){n=Number(n);return Number.isFinite(n)?Math.max(0,Math.min(1,n)):0}
