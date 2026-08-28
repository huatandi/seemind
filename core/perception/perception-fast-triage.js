export async function runPerceptionFastTriage(file,{userQuestion='',maxDimension=640,preparedSource=null}={}){
  const started=Date.now();
  const metadata={
    name:String(file?.name??''),type:String(file?.type??''),size:Number(file?.size??0),
  };
  const textIntent=detectTextIntent(userQuestion);
  const documentHint=detectDocumentHint(metadata,userQuestion);
  const visual=await inspectPixels(file,{maxDimension,preparedSource}).catch(()=>null);
  const textLikelihood=clamp(Math.max(
    textIntent?0.82:0,
    documentHint?0.72:0,
    visual?.textLikeScore??0
  ));
  const documentLikelihood=clamp(Math.max(
    documentHint?0.82:0,
    textIntent?0.58:0,
    visual?.documentLikeScore??0
  ));
  const naturalImageLikelihood=clamp(Math.max(
    visual?.naturalImageScore??0,
    1-Math.max(textLikelihood,documentLikelihood)*0.72
  ));
  const primaryRoute=chooseRoute({textLikelihood,documentLikelihood,naturalImageLikelihood,userQuestion});
  return {
    schemaVersion:1,
    kind:'perception_fast_triage',
    latencyMs:Date.now()-started,
    primaryRoute,
    textLikelihood,
    documentLikelihood,
    naturalImageLikelihood,
    needsOcr:primaryRoute==='document'||textLikelihood>=.62,
    ocrMode:primaryRoute==='document'?'primary':(textLikelihood>=.62?'support':'deferred'),
    needsGeneralVision:primaryRoute!=='document'||naturalImageLikelihood>=.45,
    needsBarcode:true,
    confidence:routeConfidence({textLikelihood,documentLikelihood,naturalImageLikelihood}),
    metadata,
    visual,
    imageQuality:preparedSource?.quality??null,
    qualityFlags:[...(preparedSource?.quality?.flags??[])],
    policy:{
      firstUsefulUnderstandingTargetMs:1500,
      deepPerceptionDeferred:true,
      receiptIsSpecialistBranch:true,
    },
  };
}

function detectTextIntent(q=''){
  return /(?:文字|写着|翻译|票据|小票|发票|账单|收据|金额|total|subtotal|factura|recibo|texto|leer|translate|read|document|receipt|invoice)/i.test(String(q));
}
function detectDocumentHint(meta,q=''){
  return /(?:receipt|invoice|factura|recibo|document|scan|screenshot|票据|小票|发票|账单|文件|截图)/i.test(`${meta.name} ${q}`);
}
function chooseRoute({textLikelihood,documentLikelihood,naturalImageLikelihood,userQuestion}){
  if(detectTextIntent(userQuestion)&&textLikelihood>=.45)return 'document';
  if(documentLikelihood>=.72&&documentLikelihood>naturalImageLikelihood+.08)return 'document';
  if(naturalImageLikelihood>=.52)return 'universal_vision';
  return 'hybrid';
}
function routeConfidence(x){
  const values=[x.textLikelihood,x.documentLikelihood,x.naturalImageLikelihood].sort((a,b)=>b-a);
  return clamp(.5+(values[0]-values[1])*.8);
}
async function inspectPixels(file,{maxDimension,preparedSource=null}){
  if(typeof document==='undefined')return null;
  let source=preparedSource?.drawable??null,ownsSource=false;
  if(!source){
    if(typeof createImageBitmap!=='function')return null;
    source=await createImageBitmap(file,{imageOrientation:'from-image'}).catch(()=>createImageBitmap(file));ownsSource=true;
  }
  const sourceWidth=Number(preparedSource?.width??source.width??source.naturalWidth??0),sourceHeight=Number(preparedSource?.height??source.height??source.naturalHeight??0);
  if(!sourceWidth||!sourceHeight)return null;
  const scale=Math.min(1,maxDimension/Math.max(sourceWidth,sourceHeight));
  const w=Math.max(1,Math.round(sourceWidth*scale)),h=Math.max(1,Math.round(sourceHeight*scale));
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,w,h);if(ownsSource)source.close?.();
  const {data}=ctx.getImageData(0,0,w,h);
  let edges=0,gray=0,colorful=0,samples=0,bright=0;
  const step=Math.max(4,Math.floor(Math.sqrt((w*h)/16000))*4);
  for(let y=1;y<h-1;y+=step)for(let x=1;x<w-1;x+=step){
    const i=(y*w+x)*4,j=(y*w+x+1)*4,k=((y+1)*w+x)*4;
    const lum=.299*data[i]+.587*data[i+1]+.114*data[i+2];
    const lumR=.299*data[j]+.587*data[j+1]+.114*data[j+2],lumD=.299*data[k]+.587*data[k+1]+.114*data[k+2];
    if(Math.abs(lum-lumR)+Math.abs(lum-lumD)>55)edges++;
    if(Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2])<18)gray++;
    else if(Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2])>55)colorful++;
    if(lum>205)bright++;samples++;
  }
  const edgeRatio=edges/Math.max(1,samples),grayRatio=gray/Math.max(1,samples),colorRatio=colorful/Math.max(1,samples),brightRatio=bright/Math.max(1,samples);
  const textLikeScore=clamp(edgeRatio*.9+grayRatio*.28+brightRatio*.18);
  const documentLikeScore=clamp(edgeRatio*.65+grayRatio*.28+brightRatio*.34-colorRatio*.18);
  const naturalImageScore=clamp(colorRatio*.58+(1-brightRatio)*.24+(1-grayRatio)*.25);
  return {width:w,height:h,edgeRatio,grayRatio,colorRatio,brightRatio,textLikeScore,documentLikeScore,naturalImageScore};
}
function clamp(v){return Math.max(0,Math.min(1,Number(v)||0))}
