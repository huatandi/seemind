import {analyzeImageQuality,chooseEnhancementPlan,candidateEnhancementPlans} from '../features/capture/image-quality.js';
import {applyEnhancementToPixels} from '../features/capture/image-preprocessor.js';

function solid(w,h,v){const d=new Uint8ClampedArray(w*h*4);for(let i=0;i<d.length;i+=4){d[i]=d[i+1]=d[i+2]=v;d[i+3]=255}return {data:d,w,h}}
function stripes(w,h,a,b){const d=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const v=x%2?a:b,i=(y*w+x)*4;d[i]=d[i+1]=d[i+2]=v;d[i+3]=255}return {data:d,w,h}}
const cases=[
 ['dark-detect',()=>analyzeImageQuality(solid(20,20,25).data,20,20,{sampleStep:1}).flags.includes('underexposed')],
 ['bright-detect',()=>analyzeImageQuality(solid(20,20,245).data,20,20,{sampleStep:1}).flags.includes('overexposed')],
 ['low-contrast',()=>analyzeImageQuality(solid(20,20,130).data,20,20,{sampleStep:1}).flags.includes('low_contrast')],
 ['edge-score',()=>{const a=analyzeImageQuality(solid(20,20,130).data,20,20,{sampleStep:1}),b=analyzeImageQuality(stripes(20,20,20,235).data,20,20,{sampleStep:1});return b.sharpness>a.sharpness}],
 ['dark-plan',()=>chooseEnhancementPlan(analyzeImageQuality(solid(20,20,25).data,20,20,{sampleStep:1})).id==='adaptive-dark'],
 ['bright-plan',()=>chooseEnhancementPlan(analyzeImageQuality(solid(20,20,245).data,20,20,{sampleStep:1})).id==='adaptive-bright'],
 ['bounded-candidates',()=>candidateEnhancementPlans(analyzeImageQuality(solid(20,20,120).data,20,20,{sampleStep:1})).length<=4],
 ['safe-baseline',()=>candidateEnhancementPlans(analyzeImageQuality(solid(20,20,120).data,20,20,{sampleStep:1})).some(x=>x.id==='gentle-gray')],
 ['alpha-safe',()=>applyEnhancementToPixels(new Uint8ClampedArray([20,40,60,77]),{grayscale:true,contrast:1.2,brightness:10,gamma:.9})[3]===77],
 ['source-immutable',()=>{const a=new Uint8ClampedArray([255,0,0,255]);const copy=[...a];applyEnhancementToPixels(a,{grayscale:true});return JSON.stringify([...a])===JSON.stringify(copy)}],
];
let passed=0;const failed=[];
for(const [id,fn] of cases){try{if(fn())passed++;else failed.push(id)}catch(e){failed.push(`${id}:${e.message}`)}}
console.log(JSON.stringify({suite:'Image Preprocessing Lab',cases:cases.length,passed,failed:failed.length,score:Math.round(passed/cases.length*100),failedCases:failed},null,2));
if(failed.length)process.exitCode=1;
