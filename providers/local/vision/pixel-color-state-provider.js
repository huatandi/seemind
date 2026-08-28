import {VisualProvider} from '../../../core/vision/providers/visual-provider.js';
import {createGeneralVisionObservation} from '../../../core/vision/general-vision-contract.js';

export class PixelColorStateProvider extends VisualProvider {
  constructor(){
    super('pixel-color-state',{
      version:'1.0.0',capabilities:[{capability:'color_state',score:.82}],
      priority:80,deviceClasses:['low_power','balanced','performance'],
      estimatedMemoryMb:8,estimatedLatencyMs:80,privacyModes:['local'],reliability:.95,
    });
  }
  async analyze(image,{capabilities=[]}={}){
    if(!capabilities.includes('color_state'))throw codeError('UNSUPPORTED_VISUAL_CAPABILITY');
    const pixels=await readPixels(image);
    const stats=analyzePixels(pixels);
    return createGeneralVisionObservation({
      providerId:this.id,
      states:[...stats.states],
      regions:stats.regions,
      confidence:stats.confidence,
      limitations:stats.limitations,
    });
  }
}

export function analyzePixels({width,height,data}={}){
  width=Number(width);height=Number(height);
  if(!Number.isFinite(width)||!Number.isFinite(height)||!data||data.length<width*height*4)throw codeError('INVALID_PIXEL_BUFFER');
  let sampled=0,red=0,green=0,bright=0,dark=0;
  let rx=0,ry=0,rc=0,gx=0,gy=0,gc=0;
  const step=Math.max(1,Math.floor(Math.sqrt((width*height)/50000)));
  for(let y=0;y<height;y+=step)for(let x=0;x<width;x+=step){
    const i=(y*width+x)*4,a=data[i+3];if(a<16)continue;
    const r=data[i],g=data[i+1],b=data[i+2];sampled++;
    const max=Math.max(r,g,b),min=Math.min(r,g,b),lum=.2126*r+.7152*g+.0722*b;
    if(lum>210)bright++;if(lum<45)dark++;
    if(r>110&&r>g*1.35&&r>b*1.35&&(max-min)>45){red++;rx+=x;ry+=y;rc++}
    if(g>90&&g>r*1.25&&g>b*1.18&&(max-min)>35){green++;gx+=x;gy+=y;gc++}
  }
  if(!sampled)throw codeError('EMPTY_PIXEL_BUFFER');
  const states=[],regions=[],redRatio=red/sampled,greenRatio=green/sampled;
  if(redRatio>=.003){
    const conf=clamp(.58+Math.min(.35,redRatio*8));
    states.push({label:'red_visual_presence',confidence:conf,evidence:{ratio:redRatio}});
    regions.push(colorRegion('red',rx/rc,ry/rc,width,height,conf));
  }
  if(greenRatio>=.003){
    const conf=clamp(.58+Math.min(.35,greenRatio*8));
    states.push({label:'green_visual_presence',confidence:conf,evidence:{ratio:greenRatio}});
    regions.push(colorRegion('green',gx/gc,gy/gc,width,height,conf));
  }
  const brightness=bright/sampled,darkness=dark/sampled;
  if(brightness>.6)states.push({label:'image_bright',confidence:clamp(.6+brightness*.35),evidence:{ratio:brightness}});
  if(darkness>.6)states.push({label:'image_dark',confidence:clamp(.6+darkness*.35),evidence:{ratio:darkness}});
  return {
    states,regions,
    confidence:states.length?Math.max(...states.map(x=>x.confidence)):.55,
    limitations:['Pixel color analysis detects color presence only; it does not identify the object or diagnose why a light is on/blinking.'],
  };
}
function colorRegion(color,cx,cy,w,h,confidence){
  const bw=Math.max(8,w*.12),bh=Math.max(8,h*.12);
  return {id:`${color}-region`,regionType:'state_region',objectType:null,confidence,
    bbox:{x:Math.max(0,cx-bw/2),y:Math.max(0,cy-bh/2),width:Math.min(bw,w),height:Math.min(bh,h)},
    tags:[`color:${color}`]};
}
async function readPixels(image){
  if(image?.data&&image?.width&&image?.height)return image;
  if(typeof document==='undefined')throw codeError('PIXEL_CANVAS_UNAVAILABLE');
  let source=image,ownsSource=false;
  if(image instanceof Blob){
    if(typeof createImageBitmap!=='function')throw codeError('IMAGE_BITMAP_UNAVAILABLE');
    source=await createImageBitmap(image);ownsSource=true;
  }
  try{
    const width=source.width??source.naturalWidth,height=source.height??source.naturalHeight;
    if(!width||!height)throw codeError('IMAGE_DIMENSIONS_UNAVAILABLE');
    const max=640,scale=Math.min(1,max/Math.max(width,height)),w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0,w,h);
    return ctx.getImageData(0,0,w,h);
  }finally{
    // Only release drawables created inside this provider. A caller-owned
    // ImageBitmap/HTMLImageElement may be shared with other visual providers.
    if(ownsSource)source.close?.();
  }
}
function codeError(code){return Object.assign(new Error(code),{code})}
function clamp(n){return Math.max(0,Math.min(1,n))}
