#!/usr/bin/env node
const {spawnSync}=require('child_process');const fs=require('fs'),path=require('path'),os=require('os');
const ROOT=path.join(__dirname,'..');
function run(label,args,env={}){console.log(`\n== ${label} ==`);const r=spawnSync(process.execPath,args,{cwd:ROOT,env:{...process.env,...env},stdio:'inherit'});if(r.status!==0)process.exit(r.status||1)}
for(const f of ['server.js','public/app.js','lib/db.js','services/intelligence.js','services/jobs.js'])run(`Syntax: ${f}`,['--check',f]);
run('Integration tests',['--test','tests/app.test.js']);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'foodsnap-release-')),db=path.join(tmp,'seed.sqlite');
run('Data Lab small seed',['--no-warnings','scripts/data-lab.js','small'],{FOODSNAP_DB:db});
run('Database integrity',['--no-warnings','scripts/integrity.js'],{FOODSNAP_DB:db});
run('HTTP smoke',['--no-warnings','scripts/smoke.js']);
if(process.env.FOODSNAP_SKIP_BROWSER!=='1')run('Chromium browser smoke',['--no-warnings','scripts/browser-smoke.js']);
for(const forbidden of ['.env','foodsnap.sqlite','test-foodsnap.sqlite','foodsnap-lab.sqlite']){if(forbidden==='.env')continue;}
fs.rmSync(tmp,{recursive:true,force:true});console.log('\nFoodSnap release checks passed.');
