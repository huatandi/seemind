import {OpenAICompatibleGatewayProvider} from '../providers/openai-compatible.js';
import {GatewayTeacherManager} from './teacher-manager.js';
import {validateVisionAttachment} from '../../core/vision/vision-attachment.js';
import {GatewaySearchService} from './search-service.js';
import {IdempotencyCache} from './idempotency-cache.js';
import {PaddleGatewayOcrService} from './paddle-ocr-service.js';

export class GatewayService{
  constructor({registry,fetchImpl=globalThis.fetch,timeoutMs=45000,manager=null,failureThreshold=2,cooldownMs=30000,searchConfig=null,ocrConfig=null}={}){
    this.registry=registry;this.fetchImpl=fetchImpl;this.timeoutMs=timeoutMs;this.manager=manager??new GatewayTeacherManager({registry,failureThreshold,cooldownMs});this.idempotency=new IdempotencyCache();this.searchService=new GatewaySearchService({config:searchConfig,fetchImpl,timeoutMs:searchConfig?.timeoutMs??15000,idempotency:this.idempotency});this.paddleOcr=new PaddleGatewayOcrService({config:ocrConfig?.paddle??{},fetchImpl});
  }
  async health(){return {status:'ok',service:'seemind-gateway',teachers:this.listTeachers().map(x=>({id:x.id,health:x.health})),search:this.searchService.publicState(),ocr:{paddle:await this.paddleOcr.health()}};}
  listTeachers(){return this.registry.listPublic().map(x=>({...x,health:this.manager.publicState(x.id)}));}
  teacherHealth(id){const config=this.registry.get(id);if(!config)throw problem(404,'TEACHER_NOT_FOUND');return {id,health:this.manager.publicState(id)};}
  async search(request){return this.searchService.search(request);}
  async paddleRecognize(request){return this.paddleOcr.recognize(request);}
  async execute(request){
    if(!request?.requestId)throw problem(400,'REQUEST_ID_REQUIRED');
    if(!request?.providerId)throw problem(400,'PROVIDER_ID_REQUIRED');
    if(!request?.taskPackage||typeof request.taskPackage!=='object')throw problem(400,'TASK_PACKAGE_REQUIRED');
    const cached=this.idempotency.get(`teacher:${request.requestId}`);if(cached)return cached;
    const config=this.registry.get(request.providerId);if(!config)throw problem(404,'TEACHER_NOT_FOUND');
    if(!this.manager.canExecute(config.id))throw problem(503,'TEACHER_CIRCUIT_OPEN');
    validateMedia(request.taskPackage,config);
    if(config.protocol!=='openai-compatible')throw problem(501,'PROTOCOL_NOT_IMPLEMENTED');
    const provider=new OpenAICompatibleGatewayProvider(config,{fetchImpl:this.fetchImpl,timeoutMs:this.timeoutMs});
    const started=Date.now();
    try{
      const result=await provider.execute(request.taskPackage);const latencyMs=Date.now()-started;this.manager.recordSuccess(config.id,{latencyMs});
      return this.idempotency.set(`teacher:${request.requestId}`,{requestId:request.requestId,result,meta:{teacherId:config.id,model:config.model,latencyMs,idempotent:true}});
    }catch(error){this.manager.recordFailure(config.id,error,{latencyMs:Date.now()-started});throw error;}
  }
}
function validateMedia(pkg,config){
  const media=pkg?.media??[];if(!Array.isArray(media))throw problem(400,'INVALID_MEDIA');if(media.length>1)throw problem(413,'TOO_MANY_MEDIA');
  for(const item of media){const checked=validateVisionAttachment(item);if(!checked.ok)throw problem(400,'INVALID_MEDIA');if(!(config.capabilities??[]).includes('vision'))throw problem(400,'TEACHER_NO_VISION');}
}
function problem(status,code){const e=new Error(code);e.status=status;e.code=code;return e;}
