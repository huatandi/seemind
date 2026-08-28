import test from 'node:test';
import assert from 'node:assert/strict';
import {createTask} from '../core/task/task.js';
import {planTask,shouldPlanTask} from '../core/planning/planner.js';
import {validateTaskGraph} from '../core/planning/task-graph.js';

function byId(g,id){return g.nodes.find(n=>n.id===id)}

test('compound capabilities trigger planning even without a domain-specific keyword',()=>{
 const task=createTask({userIntent:'帮我处理这个',requiredCapabilities:['ocr','translate','search','retrieve_current_info']});
 assert.equal(shouldPlanTask(task),true);
 const g=planTask(task);assert.equal(validateTaskGraph(g),true);
 assert.deepEqual(byId(g,'translate').dependencies,['read']);
});

test('search waits for identity when the composition requires product identity',()=>{
 const task=createTask({userIntent:'帮我看看',requiredCapabilities:['product_understanding','identify','search','retrieve_current_info']});
 const g=planTask(task);assert.deepEqual(byId(g,'search').dependencies,['identify']);
});

test('translation of visible text does not unnecessarily wait for exact product identity',()=>{
 const task=createTask({userIntent:'帮我处理',requiredCapabilities:['product_understanding','ocr','translate','explain']});
 const g=planTask(task);assert.deepEqual(byId(g,'read').dependencies,[]);assert.deepEqual(byId(g,'translate').dependencies,['read']);
});

test('comparison waits for the evidence-producing branches it actually needs',()=>{
 const task=createTask({userIntent:'帮我处理',requiredCapabilities:['product_understanding','identify','search','compare','translate','ocr']});
 const g=planTask(task);const deps=byId(g,'compare').dependencies;
 assert.ok(deps.includes('identify'));assert.ok(deps.includes('search'));assert.ok(deps.includes('translate'));
 assert.deepEqual(byId(g,'translate').dependencies,['read']);
});

test('final answer depends on graph leaves rather than blindly on every intermediate node',()=>{
 const task=createTask({userIntent:'帮我处理',requiredCapabilities:['ocr','translate','search','explain']});
 const g=planTask(task);const final=byId(g,'final');
 assert.ok(final.dependencies.includes('translate'));assert.ok(final.dependencies.includes('search'));assert.equal(final.dependencies.includes('read'),false);
});
