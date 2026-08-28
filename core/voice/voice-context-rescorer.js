export function rescoreSpeechAlternatives({alternatives=[],observation=null,conversation=[],language='auto'}={}){
 const vocab=buildContextVocabulary({observation,conversation});
 const ranked=(alternatives??[]).map((a,index)=>{
   const text=String(a.text??'').trim();
   const acoustic=Number.isFinite(Number(a.confidence))?Number(a.confidence):Math.max(.4,1-index*.08);
   const context=contextScore(text,vocab);
   // Context may rescue a close ASR alternative, but must never overpower a
   // materially stronger acoustic hypothesis.
   const score=acoustic*.72+context*.28;
   return {...a,text,acousticScore:acoustic,contextScore:context,score};
 }).filter(x=>x.text).sort((a,b)=>b.score-a.score);
 const primary=ranked[0]??null,runnerUp=ranked[1]??null;
 const quality=assessSpeechChoice(primary,runnerUp);
 return {schemaVersion:2,language,vocabulary:vocab.slice(0,40),primary,runnerUp,quality,ranked};
}

export function buildContextVocabulary({observation=null,conversation=[]}={}){
 const out=[];
 for(const o of observation?.observations??[]){
   for(const x of o.identity??[])push(out,x.label);
   for(const x of o.scene??[])push(out,x.label);
   for(const r of o.regions??[]){push(out,r.objectType);for(const t of r.tags??[])push(out,t.replace(/^color:/,''));}
   if(o.kind==='ocr')for(const token of String(o.rawText??'').split(/\s+/))if(token.length>=3&&token.length<=28)push(out,token);
   if(o.kind==='structured_facts')for(const f of o.facts??[])if(typeof f.value==='string')push(out,f.value);
 }
 for(const turn of (conversation??[]).slice(-4))for(const token of String(turn.text??'').split(/\s+/))if(token.length>=3&&token.length<=28)push(out,token);
 return [...new Set(out.map(normalize).filter(x=>x.length>=2))];
}
function contextScore(text,vocab){
 const n=normalize(text);if(!n||!vocab.length)return .5;
 const words=n.split(/\s+/).filter(Boolean);let hits=0,near=0,exactPhrase=false;
 for(const v of vocab){
   if(n===v){exactPhrase=true;hits+=2;continue}
   if(n.includes(v)||v.includes(n)){hits+=1;continue}
   const vw=v.split(/\s+/).filter(Boolean);
   for(const w of words){
     if(vw.some(x=>similar(w,x)>=.72)){near+=.5;break}
   }
 }
 const base=.4+Math.min(.5,hits*.15+near*.09);
 return Math.max(0,Math.min(1,exactPhrase?Math.max(.98,base):base));
}
function similar(a,b){
 if(!a||!b)return 0;if(a===b)return 1;
 const bigrams=s=>new Set([...Array(Math.max(0,s.length-1))].map((_,i)=>s.slice(i,i+2)));
 const A=bigrams(a),B=bigrams(b);if(!A.size||!B.size)return 0;
 let i=0;for(const x of A)if(B.has(x))i++;return 2*i/(A.size+B.size);
}
function push(out,v){const s=String(v??'').trim();if(s)out.push(s)}
function normalize(v){return String(v??'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()}

function assessSpeechChoice(primary,runnerUp){
 if(!primary)return {status:'uncertain',confidence:0,margin:0,reasons:['NO_SPEECH_HYPOTHESIS'],shouldClarify:true};
 const margin=runnerUp?primary.score-runnerUp.score:1;
 const acoustic=Number(primary.acousticScore??0),context=Number(primary.contextScore??0);
 const reasons=[];
 if(acoustic<.5)reasons.push('LOW_ACOUSTIC_CONFIDENCE');
 if(runnerUp&&margin<.07)reasons.push('ALTERNATIVES_TOO_CLOSE');
 if(context-acoustic>.35)reasons.push('CONTEXT_DOMINATES_ACOUSTIC');
 const confidence=Math.max(0,Math.min(1,acoustic*.68+context*.18+Math.min(.14,Math.max(0,margin)*1.4)));
 const shouldClarify=reasons.includes('LOW_ACOUSTIC_CONFIDENCE')||reasons.includes('ALTERNATIVES_TOO_CLOSE')||reasons.includes('CONTEXT_DOMINATES_ACOUSTIC');
 return {status:shouldClarify?'uncertain':'usable',confidence,margin,reasons,shouldClarify};
}
