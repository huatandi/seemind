export class SpeechSynthesizer {
  constructor(id='speech-synthesizer'){ this.id=id; }
  isSupported(){ return false; }
  async speak(){ throw new Error('Speech synthesis provider not configured'); }
  stop(){}
}
