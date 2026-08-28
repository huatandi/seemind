import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {loadGatewayConfig} from './core/runtime-config.js';
import {GatewayTeacherRegistry} from './core/teacher-registry.js';
import {GatewayService} from './core/gateway-service.js';

export function createGatewayServer({config=loadGatewayConfig(),fetchImpl=globalThis.fetch}={}){
  const registry=new GatewayTeacherRegistry(config.teachers);
  const service=new GatewayService({registry,fetchImpl,timeoutMs:config.requestTimeoutMs,failureThreshold:config.teacherFailureThreshold,cooldownMs:config.teacherCooldownMs,searchConfig:config.search,ocrConfig:config.ocr});
  return http.createServer(async(req,res)=>{
    const origin=req.headers.origin||'';
    if(origin&&config.allowOrigins.includes(origin))res.setHeader('access-control-allow-origin',origin);
    res.setHeader('vary','origin');
    res.setHeader('access-control-allow-headers','content-type');
    res.setHeader('access-control-allow-methods','GET,POST,OPTIONS');
    if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
    try{
      if(req.method==='GET'&&req.url==='/health')return json(res,200,await service.health());
      if(req.method==='GET'&&req.url==='/v1/teachers')return json(res,200,{teachers:service.listTeachers()});
      const healthMatch=req.method==='GET'&&req.url?.match(/^\/v1\/teachers\/([^/]+)\/health$/);
      if(healthMatch)return json(res,200,service.teacherHealth(decodeURIComponent(healthMatch[1])));
      if(req.method==='POST'&&req.url==='/v1/search'){const body=await readJson(req,config.maxBodyBytes);return json(res,200,await service.search(body));}
      if(req.method==='POST'&&req.url==='/v1/ocr/paddle'){const body=await readJson(req,Math.max(config.maxBodyBytes,6_000_000));return json(res,200,await service.paddleRecognize(body));}
      if(req.method==='POST'&&req.url==='/v1/teacher/execute'){
        const body=await readJson(req,config.maxBodyBytes);return json(res,200,await service.execute(body));
      }
      return json(res,404,{error:'NOT_FOUND'});
    }catch(error){return json(res,error.status||502,{error:error.code||'GATEWAY_FAILURE',message:safeMessage(error)});}
  });
}

function readJson(req,max){return new Promise((resolve,reject)=>{let size=0,raw='';req.setEncoding('utf8');req.on('data',chunk=>{size+=Buffer.byteLength(chunk);if(size>max){const e=new Error('PAYLOAD_TOO_LARGE');e.status=413;e.code='PAYLOAD_TOO_LARGE';reject(e);req.destroy();return}raw+=chunk});req.on('end',()=>{try{resolve(raw?JSON.parse(raw):{})}catch{const e=new Error('INVALID_JSON');e.status=400;e.code='INVALID_JSON';reject(e)}});req.on('error',reject);});}
function json(res,status,value){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));}
function safeMessage(error){const allowed=new Set(['REQUEST_ID_REQUIRED','PROVIDER_ID_REQUIRED','TASK_PACKAGE_REQUIRED','TEACHER_NOT_FOUND','PROTOCOL_NOT_IMPLEMENTED','PAYLOAD_TOO_LARGE','INVALID_JSON','TEACHER_CIRCUIT_OPEN','INVALID_MEDIA','TOO_MANY_MEDIA','TEACHER_NO_VISION','SEARCH_QUERY_REQUIRED','SEARCH_NOT_CONFIGURED','PADDLE_OCR_DISABLED','OCR_IMAGE_REQUIRED','PADDLE_OCR_TIMEOUT','PADDLE_OCR_UNAVAILABLE','PADDLE_OCR_UPSTREAM_FAILED','PADDLE_OCR_INVALID_RESPONSE']);return allowed.has(error?.code)?error.code:'Teacher gateway request failed';}

const isMain=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(isMain){const config=loadGatewayConfig();const server=createGatewayServer({config});server.listen(config.port,config.host,()=>console.log(`SeeMind Gateway listening on http://${config.host}:${config.port} with ${config.teachers.length} teacher(s)`));}
