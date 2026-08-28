import test from 'node:test';import assert from 'node:assert/strict';import {observeImage} from '../providers/local/local-student.js';
test('image observation rejects an already cancelled run before expensive work',async()=>{const c=new AbortController();c.abort();await assert.rejects(observeImage({name:'x',size:1,type:'image/png'},{signal:c.signal}),e=>e.code==='PERCEPTION_ABORTED')});
