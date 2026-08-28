export class LabResultStore{
 constructor({storageKey='seemind.perception-lab.v1'}={}){
  this.storageKey=storageKey;this.memory={};
 }
 save({engineId,modality,deviceKey='default',metrics,promotion=null,meta={}}={}){
  const all=this.#load(),key=`${deviceKey}|${modality}|${engineId}`;
  all[key]={engineId,modality,deviceKey,metrics,promotion,meta,updatedAt:new Date().toISOString()};
  this.#save(all);return all[key];
 }
 get(engineId,modality,deviceKey='default'){return this.#load()[`${deviceKey}|${modality}|${engineId}`]??null}
 list({modality=null,deviceKey=null}={}){
  return Object.values(this.#load()).filter(x=>(!modality||x.modality===modality)&&(!deviceKey||x.deviceKey===deviceKey));
 }
 #load(){try{return JSON.parse(localStorage.getItem(this.storageKey)||'{}')}catch{return {...this.memory}}}
 #save(v){this.memory={...v};try{localStorage.setItem(this.storageKey,JSON.stringify(v))}catch{}}
}
