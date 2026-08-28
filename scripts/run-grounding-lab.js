import {groundLanguageReferences} from '../core/grounding/visual-language-grounding.js';
import {fuseMultimodalContext} from '../core/multimodal/multimodal-fusion.js';

const observation={
  detectedType:'device',confidence:{overall:.82},limitations:[],
  observations:[
    {kind:'image_preprocessing',width:1000,height:800},
    {kind:'ocr',rawText:'E21',blocks:[{id:'code',text:'E21',confidence:.95,bbox:{x:710,y:80,width:90,height:45}}]},
    {kind:'structured_facts',facts:[]},
    {kind:'visual_regions',regions:[
      {id:'led-left',source:'vision',regionType:'object',objectType:'indicator_light',confidence:.95,bbox:{x:.2,y:.2,width:.04,height:.04},tags:['indicator','color:red']},
      {id:'led-right',source:'vision',regionType:'object',objectType:'indicator_light',confidence:.96,bbox:{x:.76,y:.2,width:.04,height:.04},tags:['indicator','color:red']},
    ]},
  ]
};
const refs=[
  {type:'right_side',sourceText:'右边',confidence:.9},
  {type:'red_indicator',sourceText:'红灯',confidence:.9},
  {type:'displayed_code',sourceText:'这个代码',confidence:.9},
];
const grounding=groundLanguageReferences({observation,references:refs});
const mm=fuseMultimodalContext({visualObservation:observation,speechText:'右边红灯一直闪，这个代码是什么意思？'});
const compound=grounding.compounds.find(x=>x.referenceTypes.includes('right_side')&&x.referenceTypes.includes('red_indicator'));
const code=grounding.results.find(x=>x.reference.type==='displayed_code');
const checks=[
  compound?.status==='resolved'&&compound.regionId==='led-right',
  code?.status==='resolved'&&code.regionId==='code',
  mm.references.some(x=>x.type==='red_indicator'&&x.groundingStatus==='resolved'),
  mm.unknowns.every(x=>x.id!=='reference.red_indicator'),
];
const passed=checks.filter(Boolean).length;
console.log(JSON.stringify({suite:'Visual-Language Grounding Lab',checks:checks.length,passed,failed:checks.length-passed,score:Math.round(passed/checks.length*100),compound,code},null,2));
if(passed!==checks.length)process.exitCode=1;
