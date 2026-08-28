/**
 * Converts internal runtime events into a small, monotonic user-facing progress contract.
 * This is presentation policy only: it cannot change evidence, routing, or conclusions.
 */
export function createProgressiveResponse({startedAt=Date.now(),budget=null,now=()=>Date.now()}={}){
 let rank=-1,firstUsefulAt=null,last=null;
 const history=[];
 function emit(stage,{message=null,useful=false,meta={}}={}){
   const nextRank=RANK[stage]??rank;
   if(nextRank<rank)return null; // late async events may not move the UI backwards
   rank=nextRank;
   const at=now();
   if(useful&&firstUsefulAt==null)firstUsefulAt=at;
   last=Object.freeze({schemaVersion:1,kind:'progressive_response',stage,message:message??MESSAGE[stage]??'',useful:Boolean(useful),elapsedMs:Math.max(0,at-startedAt),firstUsefulMs:firstUsefulAt==null?null:Math.max(0,firstUsefulAt-startedAt),withinFirstUsefulBudget:firstUsefulAt==null||!budget?null:(firstUsefulAt-startedAt)<=Number(budget.firstUsefulMs??Infinity),meta:{...meta}});
   history.push(last);return last;
 }
 return {emit,snapshot:()=>({schemaVersion:1,startedAt,firstUsefulAt,firstUsefulMs:firstUsefulAt==null?null:firstUsefulAt-startedAt,last,history:[...history]})};
}

export function firstUsefulMessage(triage={}){
 if(triage.primaryRoute==='document')return '已经看见文字内容，正在读取关键字段…';
 if(triage.needsOcr)return '已经看见主体和文字，正在进一步确认…';
 return '已经看见主要内容，正在进一步确认…';
}

const RANK={received:0,prepared:1,first_useful:2,refining:3,external:4,verified:5,complete:6};
const MESSAGE={received:'已收到，正在查看…',prepared:'图片已准备好…',refining:'正在进一步确认…',external:'正在查证当前信息…',verified:'结果已完成验证。',complete:'处理完成。'};
