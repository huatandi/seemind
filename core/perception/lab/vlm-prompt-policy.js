export function buildWorldVisionBenchmarkPrompt(c={}){
 const category=String(c?.category??'general');
 const expectedCount=Math.max(1,Math.min(5,(c?.expected?.labels??[]).length||3));
 return [
  'Identify the most important visible object, product, device, animal, plant, scene, sign, material, vehicle, or abnormal state.',
  `Benchmark category: ${category}.`,
  `Return a short factual description and up to ${expectedCount} concrete identifying terms.`,
  'Do not invent hidden details, model numbers, damage, danger, or text that is not visibly supported.',
  'If uncertain, say what is visible rather than guessing.',
 ].join(' ');
}
