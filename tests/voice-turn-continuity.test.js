import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveVoiceTurn,planVoiceFailureRecovery} from '../core/voice/voice-turn-continuity.js';

test('explicit Chinese correction updates previous utterance without reinterpretation',()=>{
 const x=resolveVoiceTurn({text:'不是十五，是五十',previousUserText:'这个价格是十五比索'});
 assert.equal(x.type,'correction'); assert.equal(x.resolvedText,'这个价格是五十比索');
});
test('ordinary new speech is never silently rewritten from context',()=>{
 const x=resolveVoiceTurn({text:'这个是十五吗',previousUserText:'刚才看到五十'});
 assert.equal(x.type,'new_turn'); assert.equal(x.resolvedText,'这个是十五吗');
});
test('Spanish explicit correction is supported',()=>{
 const x=resolveVoiceTurn({text:'no es quince, es cincuenta',previousUserText:'cuesta quince pesos'});
 assert.equal(x.type,'correction'); assert.equal(x.resolvedText,'cuesta cincuenta pesos');
});
test('continuation keeps visual context policy rather than asking for reperception',()=>{
 const x=resolveVoiceTurn({text:'然后这个多少钱',previousUserText:'这是什么'});
 assert.equal(x.type,'continuation'); assert.equal(x.policy,'PRESERVE_VISUAL_CONTEXT_NO_REPERCEPTION');
});
test('voice recovery is bounded and distinguishes offline fallback',()=>{
 assert.equal(planVoiceFailureRecovery({reason:'network',attempts:0,networkOnline:false,availableFallbacks:1}).action,'TRY_LOCAL_FALLBACK');
 assert.equal(planVoiceFailureRecovery({reason:'timeout',attempts:2}).retry,false);
});
