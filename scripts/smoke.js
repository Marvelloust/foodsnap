#!/usr/bin/env node
const {spawn}=require('child_process');
const path=require('path'),fs=require('fs'),os=require('os');
const port=Number(process.env.SMOKE_PORT||3199),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'foodsnap-smoke-')),db=path.join(tmp,'smoke.sqlite');
const child=spawn(process.execPath,['--no-warnings','server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),FOODSNAP_DB:db,NODE_ENV:'local'},stdio:['ignore','pipe','pipe']});
let stderr='';child.stderr.on('data',d=>stderr+=d);
async function wait(){for(let i=0;i<80;i++){try{const r=await fetch(`http://127.0.0.1:${port}/api/health`);if(r.ok)return}catch{}await new Promise(r=>setTimeout(r,100))}throw new Error(`Server did not start. ${stderr}`)}
(async()=>{try{await wait();const routes=['/','/how-it-works','/discover','/auth/sign-in','/app','/app/scan','/app/explore','/app/atlas','/app/planner','/app/community','/manifest.webmanifest','/service-worker.js'];for(const route of routes){const r=await fetch(`http://127.0.0.1:${port}${route}`,{redirect:'manual'});if(![200,302].includes(r.status))throw new Error(`${route} -> ${r.status}`);console.log(`${route.padEnd(24,'.')} ${r.status}`)}console.log('Smoke test passed.')}catch(e){console.error(e.message);process.exitCode=1}finally{child.kill('SIGTERM');setTimeout(()=>{try{child.kill('SIGKILL')}catch{};fs.rmSync(tmp,{recursive:true,force:true})},100)}})();
