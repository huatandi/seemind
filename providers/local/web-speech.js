import {SpeechRecognizer} from '../../core/voice/speech-recognizer.js';
import {SpeechSynthesizer} from '../../core/voice/speech-synthesizer.js';

export class WebSpeechRecognizer extends SpeechRecognizer {
  constructor(){ super('web-speech-recognition'); this.active=null; this.profile={streaming:true,local:false,languages:['auto'],partialResults:true,alternatives:true}; }
  isSupported(){ return typeof window!=='undefined' && Boolean(window.SpeechRecognition||window.webkitSpeechRecognition); }
  listen({language='auto',interim=true,continuous=false,maxAlternatives=3,onInterim,onAlternatives}={}){
    if(!this.isSupported()) return Promise.reject(new Error('Speech recognition is not supported on this browser'));
    this.stop();
    const Ctor=window.SpeechRecognition||window.webkitSpeechRecognition;
    const recognition=new Ctor(); this.active=recognition;
    if(language&&language!=='auto')recognition.lang=language;
    recognition.interimResults=interim; recognition.continuous=Boolean(continuous); recognition.maxAlternatives=Math.max(1,Math.min(5,Number(maxAlternatives)||3));
    return new Promise((resolve,reject)=>{
      let finalText='';let finalAlternatives=[];
      recognition.onresult=e=>{
        let interimText='';
        for(let i=e.resultIndex;i<e.results.length;i++){
          const alternatives=[...e.results[i]].map(x=>({text:x?.transcript?.trim()||'',confidence:Number(x?.confidence??0)})).filter(x=>x.text);
          const text=alternatives[0]?.text||'';
          onAlternatives?.({isFinal:e.results[i].isFinal,alternatives});
          if(e.results[i].isFinal){
            finalText+=(finalText?' ':'')+text;
            if(alternatives.length)finalAlternatives=alternatives;
          }else interimText+=(interimText?' ':'')+text;
        }
        onInterim?.((finalText+' '+interimText).trim());
      };
      recognition.onerror=e=>{ this.active=null; reject(new Error(e.error||'Speech recognition failed')); };
      recognition.onend=()=>{ this.active=null; resolve({text:finalText.trim(),alternatives:finalAlternatives,engineId:this.id}); };
      recognition.start();
    });
  }
  stop(){ try{this.active?.stop();}catch{} this.active=null; }
}

export class WebSpeechSynthesizer extends SpeechSynthesizer {
  constructor(){ super('web-speech-synthesis'); }
  isSupported(){ return typeof window!=='undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance!=='undefined'; }
  speak(text,{language='auto',rate=1}={}){
    if(!this.isSupported()) return Promise.reject(new Error('Speech synthesis is not supported on this browser'));
    this.stop();
    return new Promise((resolve,reject)=>{
      const u=new SpeechSynthesisUtterance(String(text||'')); if(language&&language!=='auto')u.lang=language; u.rate=rate;
      u.onend=()=>resolve({engineId:this.id}); u.onerror=e=>reject(new Error(e.error||'Speech synthesis failed'));
      speechSynthesis.speak(u);
    });
  }
  stop(){ if(typeof speechSynthesis!=='undefined') speechSynthesis.cancel(); }
}
