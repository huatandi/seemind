import {rankTeachers} from './teacher-router.js';
import {validateTeacherResult} from './teacher-result-validator.js';
import {sanitizeTaskPackage} from '../privacy/task-package-sanitizer.js';
import {createTeacherBudget,createBudgetState,canCallTeacher} from '../budget/teacher-budget.js';

export async function askTeacher({taskPackage,providers=[],consent=false,budget=createTeacherBudget(),audit=null,routerContext={},privacyPolicy={},performanceStore=null}={}){
  if(!taskPackage) return {status:'error',code:'NO_TASK_PACKAGE'};
  const sensitive=Boolean(taskPackage.safety?.sensitiveData);
  const hasLocal=providers.some(p=>p.getProfile?.().privacyModes?.includes('local'));
  if(sensitive && !consent && !hasLocal) return {status:'blocked',code:'CONSENT_REQUIRED',message:'需要你的允许后才能把必要内容交给老师。'};
  const state=createBudgetState(budget);
  const ranked=await rankTeachers(taskPackage,providers,{...routerContext,consent,performanceStore:performanceStore??routerContext.performanceStore});
  if(!ranked.length)return {status:'unavailable',code:'NO_TEACHER',message:'暂时没有可用的老师。'};
  const attempts=[];
  for(let i=0;i<ranked.length;i++){
    const allowed=canCallTeacher(state); if(!allowed.ok) return {status:'budget_exceeded',code:allowed.reason,attempts};
    if(i>0){ if(state.fallbacks>=state.budget.maxFallbacks) break; state.fallbacks++; }
    const {provider,score,reasons}=ranked[i];
    const isLocal=provider.getProfile?.().privacyModes?.includes('local');
    if(sensitive && !consent && !isLocal) continue;
    const sanitized=sanitizeTaskPackage(taskPackage,{...privacyPolicy,localProvider:isLocal,allowImages:Boolean(privacyPolicy.allowImages&&consent)}).package;
    state.calls++;
    const auditMeta={taskId:taskPackage?.task?.id,operationKey:taskPackage?.execution?.idempotencyKey??null};
    audit?.record?.('teacher_attempt',{...auditMeta,providerId:provider.id,score,reasons,call:state.calls,fallback:i>0});
    const started=Date.now();
    try{
      const estimate=await provider.estimate?.(sanitized).catch?.(()=>null);
      if(estimate?.estimatedCost!=null) state.spent+=Number(estimate.estimatedCost)||0;
      const raw=await provider.execute(sanitized);
      const judged=validateTeacherResult(raw,sanitized);
      attempts.push({providerId:provider.id,status:judged.ok?'ok':'invalid'});
      if(judged.ok){performanceStore?.record?.(provider.id,taskPackage?.task?.type,{success:true,latencyMs:Date.now()-started,cost:estimate?.estimatedCost});audit?.record?.('teacher_success',{...auditMeta,providerId:provider.id,latencyMs:Date.now()-started});audit?.record?.('result_accepted',{...auditMeta,providerId:provider.id,reason:'TEACHER_RESULT_VALIDATED'});return {status:'ok',providerId:provider.id,result:judged.value,attempts,router:{score,reasons},budget:{calls:state.calls,fallbacks:state.fallbacks,spent:state.spent}}}
      performanceStore?.record?.(provider.id,taskPackage?.task?.type,{success:false,latencyMs:Date.now()-started,cost:estimate?.estimatedCost});
      audit?.record?.('teacher_invalid',{...auditMeta,providerId:provider.id,issues:judged.issues});audit?.record?.('result_rejected',{...auditMeta,providerId:provider.id,reason:'VALIDATION_FAILED'});
    }catch(error){
      performanceStore?.record?.(provider.id,taskPackage?.task?.type,{success:false,latencyMs:Date.now()-started});
      attempts.push({providerId:provider.id,status:'error'}); audit?.record?.('teacher_error',{...auditMeta,providerId:provider.id,error:String(error?.message||error)});
    }
  }
  const onlyInvalid=attempts.length>0 && attempts.every(x=>x.status==='invalid');
  if(onlyInvalid) return {status:'invalid',code:'INVALID_TEACHER_RESULT',message:'老师返回的结果没有通过验证。',attempts,budget:{calls:state.calls,fallbacks:state.fallbacks,spent:state.spent}};
  return {status:'error',code:'ALL_TEACHERS_FAILED',message:'老师这次没有回答成功。',attempts,budget:{calls:state.calls,fallbacks:state.fallbacks,spent:state.spent}};
}
