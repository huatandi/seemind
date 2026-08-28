const ALLOWED_TASKS=new Set(['receipt','entity','freshness','evidence','teacher','provider','planner','recovery','generic']);

export function createGoldenCase(input={}){
  if(!input.id)throw new Error('GOLDEN_CASE_ID_REQUIRED');
  const task=String(input.task??'generic');
  if(!ALLOWED_TASKS.has(task))throw new Error('GOLDEN_CASE_TASK_INVALID');
  return Object.freeze({
    schemaVersion:1,id:String(input.id),task,
    title:String(input.title??input.id),
    tags:[...(input.tags??[])].map(String),
    input:structuredCloneSafe(input.input??{}),
    expected:structuredCloneSafe(input.expected??{}),
    critical:Boolean(input.critical),
    weight:Number.isFinite(Number(input.weight))?Math.max(.1,Number(input.weight)):1,
    notes:String(input.notes??'').slice(0,500),
  });
}

export class GoldenDataset{
  constructor(cases=[]){this.cases=[];for(const c of cases)this.add(c)}
  add(value){const c=createGoldenCase(value);if(this.cases.some(x=>x.id===c.id))throw new Error(`DUPLICATE_GOLDEN_CASE:${c.id}`);this.cases.push(c);return c}
  list({task=null,tags=[]}={}){return this.cases.filter(c=>(!task||c.task===task)&&tags.every(t=>c.tags.includes(t)))}
  get(id){return this.cases.find(c=>c.id===id)??null}
  summary(){return {caseCount:this.cases.length,criticalCount:this.cases.filter(x=>x.critical).length,byTask:Object.fromEntries([...new Set(this.cases.map(x=>x.task))].map(t=>[t,this.cases.filter(x=>x.task===t).length]))}}
}
function structuredCloneSafe(v){return v==null?v:JSON.parse(JSON.stringify(v))}
