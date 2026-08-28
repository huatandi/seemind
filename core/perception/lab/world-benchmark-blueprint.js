export const WORLD_VISION_CATEGORIES=Object.freeze([
 {id:'everyday_objects',weight:.12,examples:['tool','appliance','furniture','unknown object']},
 {id:'products_models',weight:.12,examples:['electronics','packaging','model plate','consumer product']},
 {id:'plants_animals',weight:.12,examples:['plant','leaf','insect','animal']},
 {id:'devices_components',weight:.12,examples:['machine','connector','indicator','component']},
 {id:'scenes_places',weight:.10,examples:['room','street','store','building','outdoor scene']},
 {id:'food_materials',weight:.08,examples:['food','ingredient','material','surface']},
 {id:'vehicles_transport',weight:.08,examples:['vehicle','dashboard','part','transport scene']},
 {id:'signs_symbols',weight:.08,examples:['warning sign','icon','label','symbol']},
 {id:'anomaly_visual',weight:.10,examples:['damage','leak','crack','abnormal state']},
 {id:'documents_receipts',weight:.08,examples:['document','receipt','invoice','form']},
]);

export const VOICE_CATEGORIES=Object.freeze([
 {id:'plain_intent',weight:.18},
 {id:'visual_reference',weight:.24},
 {id:'brand_model_terms',weight:.16},
 {id:'problem_description',weight:.18},
 {id:'mixed_language',weight:.12},
 {id:'noisy_or_uncertain',weight:.12},
]);

export function validateWorldBenchmarkCoverage(cases=[]){
 const counts=Object.fromEntries(WORLD_VISION_CATEGORIES.map(x=>[x.id,0]));
 for(const c of cases)if(c.category in counts)counts[c.category]++;
 const total=cases.length||1;
 const documentShare=(counts.documents_receipts??0)/total;
 const missing=WORLD_VISION_CATEGORIES.filter(x=>counts[x.id]===0).map(x=>x.id);
 return {
   schemaVersion:1,total,counts,documentShare,missing,
   passed:documentShare<=.15&&missing.length===0,
   rules:{
     maxDocumentShare:.15,
     principle:'Universal-world cases dominate. Receipt/document cases are specialist coverage, not the benchmark center.',
   },
 };
}

export function weightedWorldScore(categoryScores={}){
 let score=0,weight=0;
 for(const c of WORLD_VISION_CATEGORIES){
   const v=Number(categoryScores[c.id]);
   if(Number.isFinite(v)){score+=v*c.weight;weight+=c.weight}
 }
 return weight?score/weight:null;
}
