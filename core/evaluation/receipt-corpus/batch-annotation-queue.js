export class BatchAnnotationQueue{
  constructor({sessionId=`batch-${Date.now()}`,items=[],activeCaseId=null}={}){
    this.sessionId=String(sessionId);
    this.items=items.map(normalize);
    this.activeCaseId=activeCaseId??this.items[0]?.caseId??null;
  }
  add(meta){
    const x=normalize(meta);
    if(this.items.some(i=>i.caseId===x.caseId))throw new Error(`BATCH_DUPLICATE_CASE:${x.caseId}`);
    this.items.push(x);if(!this.activeCaseId)this.activeCaseId=x.caseId;return x;
  }
  get(caseId){return this.items.find(x=>x.caseId===String(caseId))??null}
  active(){return this.get(this.activeCaseId)}
  select(caseId){if(!this.get(caseId))throw new Error('BATCH_CASE_NOT_FOUND');this.activeCaseId=String(caseId);return this.active()}
  attachDraft(caseId,draft){const x=this.get(caseId);if(!x)throw new Error('BATCH_CASE_NOT_FOUND');x.draft=draft;x.errorCode=null;return x}
  fail(caseId,errorCode){const x=this.get(caseId);if(!x)throw new Error('BATCH_CASE_NOT_FOUND');x.errorCode=String(errorCode??'INTAKE_FAILED');return x}
  skip(caseId=this.activeCaseId){const x=this.get(caseId);if(!x)throw new Error('BATCH_CASE_NOT_FOUND');x.skipped=true;return this.next()}
  unskip(caseId){const x=this.get(caseId);if(!x)throw new Error('BATCH_CASE_NOT_FOUND');x.skipped=false;return x}
  next({stage=null}={}){
    if(!this.items.length)return null;
    const start=Math.max(0,this.items.findIndex(x=>x.caseId===this.activeCaseId));
    for(let step=1;step<=this.items.length;step++){
      const x=this.items[(start+step)%this.items.length];
      if(!x.skipped&&(!stage||stageOf(x)===stage)){this.activeCaseId=x.caseId;return x}
    }
    return this.active();
  }
  previous(){
    if(!this.items.length)return null;
    const start=Math.max(0,this.items.findIndex(x=>x.caseId===this.activeCaseId));
    for(let step=1;step<=this.items.length;step++){
      const x=this.items[(start-step+this.items.length)%this.items.length];
      if(!x.skipped){this.activeCaseId=x.caseId;return x}
    }
    return this.active();
  }
  list({stage='all'}={}){return this.items.filter(x=>stage==='all'||stageOf(x)===stage)}
  summary(){
    const byStage={pending:0,annotation:0,review:0,eligible:0,error:0,skipped:0};
    for(const x of this.items)byStage[stageOf(x)]++;
    return {sessionId:this.sessionId,count:this.items.length,activeCaseId:this.activeCaseId,byStage};
  }
  snapshot(){return {sessionId:this.sessionId,activeCaseId:this.activeCaseId,items:this.items.map(x=>({...x,draft:x.draft?JSON.parse(JSON.stringify(x.draft)):null}))}}
  static fromSnapshot(s={}){return new BatchAnnotationQueue(s)}
}
export function stageOf(x){
  if(x.skipped)return 'skipped';
  if(x.errorCode)return 'error';
  return x.draft?.workflow?.stage??'pending';
}
function normalize(x={}){
  if(!x.caseId)throw new Error('BATCH_CASE_ID_REQUIRED');
  return {caseId:String(x.caseId),fileName:String(x.fileName??''),fileType:String(x.fileType??''),fileSize:Number(x.fileSize??0)||0,imageRef:String(x.imageRef??''),draft:x.draft??null,skipped:Boolean(x.skipped),errorCode:x.errorCode??null};
}
