export class ReceiptIntakePersistence{
  constructor({storage=globalThis.localStorage,key='seemind:receipt-intake:v1'}={}){
    this.storage=storage;this.key=key;
  }
  save(snapshot){
    const safe=sanitizeSnapshot(snapshot);
    try{this.storage?.setItem?.(this.key,JSON.stringify(safe));return safe}
    catch(error){throw Object.assign(new Error('INTAKE_PERSISTENCE_SAVE_FAILED'),{cause:error})}
  }
  load(){
    try{
      const raw=this.storage?.getItem?.(this.key);
      if(!raw)return null;
      return sanitizeSnapshot(JSON.parse(raw));
    }catch{return null}
  }
  clear(){try{this.storage?.removeItem?.(this.key)}catch{}}
}

export function sanitizeSnapshot(snapshot={}){
  return {
    schemaVersion:1,
    sessionId:String(snapshot.sessionId??''),
    activeCaseId:snapshot.activeCaseId?String(snapshot.activeCaseId):null,
    savedAt:new Date().toISOString(),
    items:(snapshot.items??[]).map(x=>({
      caseId:String(x.caseId),
      fileName:String(x.fileName??''),
      fileType:String(x.fileType??''),
      fileSize:Number(x.fileSize??0)||0,
      imageRef:String(x.imageRef??''),
      draft:x.draft?JSON.parse(JSON.stringify(x.draft)):null,
      skipped:Boolean(x.skipped),
      errorCode:x.errorCode?String(x.errorCode):null,
    })),
  };
}
