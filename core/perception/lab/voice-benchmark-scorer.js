import {wordErrorRate,intentAccuracy} from './benchmark-metrics.js';

export function scoreVoiceBenchmarkCase({case:c,result}={}){
 const expectedText=String(c?.expected?.text??'').trim();
 const actualText=String(result?.text??result??'').trim();
 const wer=wordErrorRate(expectedText,actualText);
 const expectedIntent=c?.expected?.intent??null,actualIntent=result?.intent??null;
 const intent=expectedIntent?intentAccuracy(expectedIntent,actualIntent):null;
 const quality=Math.max(0,1-Math.min(1,wer));
 return {ok:Boolean(actualText),quality,details:{expectedText,actualText,wer,expectedIntent,actualIntent,intentAccuracy:intent}};
}
