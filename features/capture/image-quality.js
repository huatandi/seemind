export function analyzeImageQuality(imageData,width,height,{sampleStep=null,maxSamples=120000,signal=null,deadlineAt=null}={}){
  const d=imageData?.data??imageData;
  if(!d||!width||!height)throw new Error('IMAGE_DATA_REQUIRED');
  const step=resolveQualitySampleStep(width,height,{sampleStep,maxSamples});
  let n=0,sum=0,sum2=0,dark=0,bright=0,gradientSum=0,gradientN=0;
  for(let y=0;y<height;y+=step){
    if((y&31)===0){throwIfAborted(signal);throwIfDeadline(deadlineAt)}
    for(let x=0;x<width;x+=step){
      const i=(y*width+x)*4;
      const v=.299*d[i]+.587*d[i+1]+.114*d[i+2];
      n++;sum+=v;sum2+=v*v;
      if(v<35)dark++; if(v>235)bright++;
      if(x+step<width){
        const j=(y*width+(x+step))*4;
        const vr=.299*d[j]+.587*d[j+1]+.114*d[j+2];
        gradientSum+=Math.abs(v-vr);gradientN++;
      }
      if(y+step<height){
        const j=((y+step)*width+x)*4;
        const vb=.299*d[j]+.587*d[j+1]+.114*d[j+2];
        gradientSum+=Math.abs(v-vb);gradientN++;
      }
    }
  }
  const mean=sum/Math.max(1,n);
  const variance=Math.max(0,sum2/Math.max(1,n)-mean*mean);
  const contrast=Math.sqrt(variance);
  const darkRatio=dark/Math.max(1,n),brightRatio=bright/Math.max(1,n);
  const sharpness=gradientSum/Math.max(1,gradientN);
  const flags=[];
  if(mean<75)flags.push('underexposed');
  if(mean>205)flags.push('overexposed');
  if(contrast<38)flags.push('low_contrast');
  if(sharpness<9)flags.push('blurry_or_low_detail');
  if(darkRatio>.28)flags.push('dark_clipping');
  if(brightRatio>.42)flags.push('highlight_clipping');
  return {
    schemaVersion:1,
    brightness:round(mean),
    contrast:round(contrast),
    sharpness:round(sharpness),
    darkRatio:round(darkRatio,4),
    brightRatio:round(brightRatio,4),
    flags,
    score:qualityScore({mean,contrast,sharpness,darkRatio,brightRatio}),
  };
}

export function resolveQualitySampleStep(width,height,{sampleStep=null,maxSamples=120000}={}){
  if(sampleStep!=null)return Math.max(1,Math.floor(Number(sampleStep)||1));
  const pixels=Math.max(1,Number(width)||1)*Math.max(1,Number(height)||1);
  const budget=Math.max(1000,Number(maxSamples)||120000);
  // Keep the historical 4px baseline for ordinary images, but prevent quality
  // scoring itself from becoming a megapixel-scale CPU task on large captures.
  return Math.max(4,Math.ceil(Math.sqrt(pixels/budget)));
}

export function chooseEnhancementPlan(quality={}){
  const flags=new Set(quality.flags??[]);
  let contrast=1.12,brightness=0,gamma=1;
  if(flags.has('low_contrast'))contrast=1.42;
  else if((quality.contrast??0)>72)contrast=1.04;

  if(flags.has('underexposed')){brightness=24;gamma=.86}
  if(flags.has('overexposed')){brightness=-16;gamma=1.12}
  if(flags.has('highlight_clipping'))contrast=Math.min(contrast,1.18);

  const sharpen=flags.has('blurry_or_low_detail')?.22:.08;
  return {
    id:planId(flags),
    grayscale:true,
    contrast:round(contrast,3),
    brightness,
    gamma:round(gamma,3),
    sharpen,
    rationale:[...flags],
  };
}

export function candidateEnhancementPlans(quality={}){
  const primary=chooseEnhancementPlan(quality);
  const candidates=[
    primary,
    {id:'gentle-gray',grayscale:true,contrast:1.08,brightness:0,gamma:1,sharpen:.05,rationale:['safe_baseline']},
  ];
  if((quality.flags??[]).includes('low_contrast'))candidates.push({id:'strong-contrast',grayscale:true,contrast:1.58,brightness:0,gamma:1,sharpen:.12,rationale:['low_contrast']});
  if((quality.flags??[]).includes('underexposed'))candidates.push({id:'dark-recovery',grayscale:true,contrast:1.26,brightness:32,gamma:.8,sharpen:.08,rationale:['underexposed']});
  if((quality.flags??[]).includes('overexposed'))candidates.push({id:'highlight-recovery',grayscale:true,contrast:1.1,brightness:-24,gamma:1.18,sharpen:.05,rationale:['overexposed']});
  return uniqueById(candidates).slice(0,4);
}

function qualityScore({mean,contrast,sharpness,darkRatio,brightRatio}){
  const exposure=1-Math.min(1,Math.abs(mean-145)/145);
  const contrastScore=Math.min(1,contrast/58);
  const sharpnessScore=Math.min(1,sharpness/22);
  const clippingPenalty=Math.min(.5,darkRatio*.6+brightRatio*.6);
  return round(Math.max(0,Math.min(1,.34*exposure+.33*contrastScore+.33*sharpnessScore-clippingPenalty)),3);
}
function planId(flags){
  if(flags.has('underexposed'))return 'adaptive-dark';
  if(flags.has('overexposed'))return 'adaptive-bright';
  if(flags.has('low_contrast'))return 'adaptive-low-contrast';
  if(flags.has('blurry_or_low_detail'))return 'adaptive-soft';
  return 'adaptive-clean';
}
function uniqueById(list){const seen=new Set();return list.filter(x=>!seen.has(x.id)&&(seen.add(x.id),true))}
function round(n,d=2){const p=10**d;return Math.round(Number(n)*p)/p}

function throwIfAborted(signal){if(signal?.aborted){const e=new Error('IMAGE_PREPROCESS_ABORTED');e.code='IMAGE_PREPROCESS_ABORTED';throw e}}
function throwIfDeadline(deadlineAt){if(deadlineAt!=null&&(globalThis.performance?.now?.()??Date.now())>=Number(deadlineAt)){const e=new Error('IMAGE_PREPROCESS_BUDGET_EXHAUSTED');e.code='IMAGE_PREPROCESS_BUDGET_EXHAUSTED';throw e}}
