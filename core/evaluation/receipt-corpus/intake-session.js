import {createAnnotationDraft} from './annotation-workflow.js';

export class ReceiptCorpusIntakeSession{
  constructor({sessionId=`intake-${Date.now()}`,annotatorId=null}={}){
    this.sessionId=String(sessionId);this.annotatorId=annotatorId;this.items=new Map();
  }
  add({caseId,imageRef,studentObservation,receiptType='unknown',difficulty='unknown',provenance={}}){
    if(this.items.has(caseId))throw new Error(`INTAKE_DUPLICATE_CASE:${caseId}`);
    const draft=createAnnotationDraft({caseId,imageRef,studentObservation,receiptType,difficulty,annotatorId:this.annotatorId,provenance});
    this.items.set(String(caseId),draft);return draft;
  }
  update(caseId,draft){if(!this.items.has(String(caseId)))throw new Error('INTAKE_CASE_NOT_FOUND');this.items.set(String(caseId),draft);return draft}
  get(caseId){return this.items.get(String(caseId))??null}
  list(){return [...this.items.values()]}
  summary(){
    const rows=this.list();
    const byStage={};for(const x of rows){const s=x.workflow?.stage??'unknown';byStage[s]=(byStage[s]??0)+1}
    return {sessionId:this.sessionId,count:rows.length,byStage};
  }
}
