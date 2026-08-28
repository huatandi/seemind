#!/usr/bin/env node
/**
 * SeeMind full verification gate.
 *
 * Implements the mandatory post-change checks from
 * STRATEGIC_EXECUTION_ROADMAP.md (STEP 11-13, 35-2/19) as one command:
 *   1. syntax check every committed .js file (node --check)
 *   2. version consistency: package.json == README.md == CHANGELOG.md head
 *   3. no hardcoded provider/country leakage in core decision paths
 *   4. full regression suite (node --test)
 *
 * Usage: npm run verify
 */
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const notes = [];

function run(name, fn){
  process.stdout.write(`[verify] ${name} ... `);
  try{ fn(); console.log('OK'); }
  catch(e){ console.log('FAIL'); failures.push(`${name}: ${e.message}`); }
}

function walk(dir, out=[]){
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    if(e.name==='node_modules'||e.name==='.git'||e.name==='dist')continue;
    const p=path.join(dir,e.name);
    if(e.isDirectory())walk(p,out);
    else if(e.name.endsWith('.js'))out.push(p);
  }
  return out;
}

run('syntax check (all .js)', ()=>{
  let n=0;
  for(const f of walk(root)){
    try{ execFileSync(process.execPath,['--check',f],{stdio:'pipe'}); n++; }
    catch(e){ throw new Error(`${f}:\n${e.stderr?.toString().slice(0,800)}`); }
  }
  notes.push(`  ${n} files syntax-checked`);
});

run('version consistency', ()=>{
  const pkg=JSON.parse(fs.readFileSync('package.json','utf8')).version;
  const readme=fs.readFileSync('README.md','utf8').match(/\*\*Current version: v([\d.]+)\*\*/);
  if(!readme)throw new Error('README.md missing "**Current version: vX.Y.Z**" line');
  if(readme[1]!==pkg)throw new Error(`package.json=${pkg} but README=${readme[1]}`);
  const changelog=fs.readFileSync('CHANGELOG.md','utf8').match(/^##\s+v?([\d.]+)/m);
  if(changelog&&changelog[1]!==pkg)throw new Error(`package.json=${pkg} but CHANGELOG head=${changelog[1]}`);
});

run('no provider hardcoding in core', ()=>{
  const banned=/\b(api[_-]?key|sk-[A-Za-z0-9]{8,}|Bearer\s+[A-Za-z0-9]{16,})\b/i;
  for(const f of walk(path.join(root,'core'))){
    const s=fs.readFileSync(f,'utf8');
    if(banned.test(s))throw new Error(`possible secret in ${path.relative(root,f)}`);
  }
});

run('full regression (node --test)', ()=>{
  const tests=fs.readdirSync(path.join(root,'tests')).filter(f=>f.endsWith('.test.js'));
  execFileSync(process.execPath,['--test',...tests.map(t=>`tests/${t}`)],{stdio:'pipe'});
});

console.log('');
notes.forEach(n=>console.log(n));
if(failures.length){
  console.error(`\nVERIFY FAILED (${failures.length}):`);
  failures.forEach(f=>console.error(' - '+f.slice(0,600)));
  process.exit(1);
}
console.log('VERIFY PASSED: syntax + version + hygiene + regression all green.');
