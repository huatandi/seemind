export class IdempotentActionExecutor{
  constructor({store=null}={}){this.store=store??new Map()}
  async execute(proposal,handler){
    if(!proposal?.idempotencyKey)throw new Error('ACTION_IDEMPOTENCY_KEY_REQUIRED');
    if(typeof handler!=='function')throw new Error('ACTION_HANDLER_REQUIRED');
    const key=String(proposal.idempotencyKey);
    const existing=await read(this.store,key);
    if(existing?.status==='completed')return {...existing,replayed:true};
    await write(this.store,key,{status:'running',actionId:proposal.id,startedAt:new Date().toISOString()});
    try{
      const result=await handler(proposal);
      const receipt={status:'completed',actionId:proposal.id,result,completedAt:new Date().toISOString()};
      await write(this.store,key,receipt);return {...receipt,replayed:false};
    }catch(error){
      await write(this.store,key,{status:'failed',actionId:proposal.id,error:String(error?.message??error).slice(0,300),completedAt:new Date().toISOString()});throw error;
    }
  }
}
async function read(store,key){if(store?.get)return await store.get(key);if(store?.load)return await store.load(key);return null}
async function write(store,key,value){if(store?.set)return await store.set(key,value);if(store?.save)return await store.save(key,value);throw new Error('ACTION_STORE_INVALID')}
