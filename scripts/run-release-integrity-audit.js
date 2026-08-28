import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';

const root=process.cwd();
const failures=[];
const mustExist=[
 'core/perception/perception-boundary.js',
 'core/resolution/problem-understanding.js',
 'core/orchestration/unified-orchestrator.js',
 'core/orchestration/intelligence-gap-router.js',
 'core/teacher/teacher-router.js',
 'core/verification/verification-core.js',
 'apps/web/src/runtime/pilot-lab-runtime.js',
 'ARCHITECTURE_FREEZE.md',
];
const mustNotExist=[
 'core/orchestration/specialist-selector.js',
 'core/decision/decision-engine.js',
 'core/teacher/teacher-performance.js',
 'core/shared/result.js',
];
for(const f of mustExist)if(!fs.existsSync(path.join(root,f)))failures.push(`MISSING:${f}`);
for(const f of mustNotExist)if(fs.existsSync(path.join(root,f)))failures.push(`OBSOLETE_PRESENT:${f}`);
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
if(pkg.version!=='0.70.0')failures.push(`VERSION_MISMATCH:${pkg.version}`);

const fingerprintPath=path.join(root,'RELEASE_FINGERPRINT.json');
if(!fs.existsSync(fingerprintPath))failures.push('RELEASE_FINGERPRINT_MISSING');
else{
 const fp=JSON.parse(fs.readFileSync(fingerprintPath,'utf8'));
 if(fp.version!==pkg.version)failures.push(`FINGERPRINT_VERSION_MISMATCH:${fp.version}`);
 for(const [file,expected] of Object.entries(fp.criticalFiles??{})){
  const full=path.join(root,file);
  if(!fs.existsSync(full)){failures.push(`FINGERPRINT_FILE_MISSING:${file}`);continue}
  const actual=crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
  if(actual!==expected)failures.push(`FINGERPRINT_HASH_MISMATCH:${file}`);
 }
}

const main=fs.readFileSync(path.join(root,'apps/web/src/main.js'),'utf8');
const mainLines=main.split(/\r?\n/).length;
if(mainLines>600)failures.push(`MAIN_ENTRY_TOO_LARGE:${mainLines}`);
for(const forbidden of ['pilot-lab-controller.js','benchmark-competition.js','experimental-engine-catalog.js','voice-league.js']){
 if(main.includes(forbidden))failures.push(`LAB_EAGER_IMPORT:${forbidden}`);
}
if(!main.includes("import('./runtime/pilot-lab-runtime.js')"))failures.push('PILOT_LAB_NOT_LAZY');
// Scan JS syntax without requiring build dependencies.
const jsFiles=[];
function walk(dir){for(const d of fs.readdirSync(dir,{withFileTypes:true})){if(d.name==='node_modules'||d.name==='.git'||d.name==='dist')continue;const p=path.join(dir,d.name);if(d.isDirectory())walk(p);else if(d.name.endsWith('.js'))jsFiles.push(p)}}
walk(root);
for(const f of jsFiles){try{execFileSync(process.execPath,['--check',f],{stdio:'pipe'})}catch{failures.push(`SYNTAX:${path.relative(root,f)}`)}}
const report={version:pkg.version,ok:failures.length===0,mainLines,jsFiles:jsFiles.length,failures};
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exit(1);
