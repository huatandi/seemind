import {buildTeacherMessages} from '../core/task-prompt.js';

export class OpenAICompatibleGatewayProvider{
  constructor(config,{fetchImpl=globalThis.fetch,timeoutMs=45000}={}){this.config=config;this.fetchImpl=fetchImpl;this.timeoutMs=timeoutMs;}
  async healthCheck(){return {status:'ready'};}
  async execute(taskPackage){
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
    try{
      const headers={'content-type':'application/json','accept':'application/json'};if(this.config.apiKey)headers.authorization=`Bearer ${this.config.apiKey}`;
      const response=await this.fetchImpl(`${this.config.endpoint}/chat/completions`,{method:'POST',headers,signal:controller.signal,body:JSON.stringify({model:this.config.model,messages:buildTeacherMessages(taskPackage),temperature:0,response_format:{type:'json_object'}})});
      if(!response.ok){const e=new Error(`upstream_http_${response.status}`);e.code=`UPSTREAM_HTTP_${response.status}`;throw e;}
      const raw=await response.json();const content=raw?.choices?.[0]?.message?.content;if(!content)throw new Error('upstream_answer_missing');
      let parsed;try{parsed=typeof content==='string'?JSON.parse(content):content;}catch{throw new Error('upstream_answer_not_json');}return parsed;
    }finally{clearTimeout(timer);}
  }
}
