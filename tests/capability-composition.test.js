import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyWorldDomain} from '../core/world/universal-world-router.js';
import {understandUniversalIntent} from '../core/intent/universal-intent-router.js';
import {composeCapabilities} from '../core/world/capability-composition.js';
import {buildUniversalExplanation} from '../core/explanation/universal-explainer.js';

const observation=(label='food',text='')=>({detectedType:label,extractedText:text,confidence:{overall:.8},limitations:[],localResolutionPossible:true,observations:[{kind:'general_vision',providerId:'v',identity:[{label,confidence:.9}],scene:[],states:[],regions:[]},{kind:'structured_facts',facts:[]},{kind:'visual_capability_plan',route:{missingCapabilities:[]},providerExecution:{requiredCapabilities:[]}}]});

test('world classification preserves multiple active domains instead of only the winner',()=>{
 const d=classifyWorldDomain({observation:observation('food','INGREDIENTES'),problem:{userQuestion:'这个食品帮我翻译配料'}});
 assert.equal(d.primary,'translation');
 assert.ok(d.active.some(x=>x.domain==='food'));
 assert.ok(d.active.some(x=>x.domain==='translation'));
});

test('capability composition combines domain and compound intent requirements',()=>{
 const d={primary:'food',active:[{domain:'food',confidence:.9},{domain:'product',confidence:.8}]};
 const i=understandUniversalIntent({text:'翻译一下，再比较哪个好，哪里可以买？',worldDomain:d});
 const p=composeCapabilities({worldDomain:d,intentGraph:i});
 assert.ok(p.capabilities.includes('food_understanding'));
 assert.ok(p.capabilities.includes('product_understanding'));
 assert.ok(p.capabilities.includes('translate'));
 assert.ok(p.capabilities.includes('compare'));
 assert.ok(p.capabilities.includes('search'));
 assert.equal(p.compound,true);
});

test('single simple request remains lightweight rather than manufacturing capabilities',()=>{
 const p=composeCapabilities({worldDomain:{primary:'plant'},intentGraph:{primary:'identify',intents:[{intent:'identify',confidence:.9}]}});
 assert.deepEqual(p.domains,['plant']);
 assert.ok(p.capabilities.includes('plant_understanding'));
 assert.ok(p.capabilities.includes('identify'));
 assert.equal(p.externalCapabilities.length,0);
});

test('universal explanation exposes composed capabilities for multi-purpose real-world request',()=>{
 const e=buildUniversalExplanation({observation:observation('food','INGREDIENTES'),textInput:'这个食品是什么？翻译配料，哪里可以买？'});
 assert.ok(e.capabilityPlan.domains.includes('food'));
 assert.ok(e.capabilityPlan.capabilities.includes('translate'));
 assert.ok(e.capabilityPlan.capabilities.includes('search'));
 assert.equal(e.capabilityPlan.principle,'COMPOSE_CAPABILITIES_DO_NOT_FORCE_SINGLE_DOMAIN');
});
