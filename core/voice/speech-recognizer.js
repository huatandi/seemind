export class SpeechRecognizer {
  constructor(id='speech-recognizer'){ this.id=id; }
  isSupported(){ return false; }
  async listen(){ throw new Error('Speech recognition provider not configured'); }
  stop(){}
}
