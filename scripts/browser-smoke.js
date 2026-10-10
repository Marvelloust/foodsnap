#!/usr/bin/env node
const {spawn,spawnSync}=require('child_process');
const fs=require('fs'),path=require('path'),os=require('os');
const ROOT=path.join(__dirname,'..'),APP_PORT=Number(process.env.BROWSER_SMOKE_PORT||3217),DEBUG_PORT=Number(process.env.BROWSER_DEBUG_PORT||9337),APP_API=`http://127.0.0.1:${APP_PORT}`,APP=`http://foodsnap.test:${APP_PORT}`;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'foodsnap-browser-')),db=path.join(tmp,'browser.sqlite'),chromeDir=path.join(tmp,'chrome');
const chromium=process.env.CHROMIUM_BIN||['chromium','google-chrome','chromium-browser'].map(x=>spawnSync('bash',['-lc',`command -v ${x}`],{encoding:'utf8'}).stdout.trim()).find(Boolean);
if(!chromium){console.error('Chromium was not found. Set CHROMIUM_BIN to run browser smoke tests.');process.exit(2)}
const server=spawn(process.execPath,['--no-warnings','server.js'],{cwd:ROOT,env:{...process.env,PORT:String(APP_PORT),APP_ORIGIN:APP,FOODSNAP_DB:db,NODE_ENV:'test'},stdio:['ignore','pipe','pipe']});
let serverErr='';server.stderr.on('data',d=>serverErr+=String(d));
const chrome=spawn(chromium,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',`--remote-debugging-port=${DEBUG_PORT}`,`--user-data-dir=${chromeDir}`,'--proxy-server=direct://','--proxy-bypass-list=*','--host-resolver-rules=MAP foodsnap.test 127.0.0.1','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(url,tries=100){for(let i=0;i<tries;i++){try{const r=await fetch(url);if(r.ok)return r}catch{}await sleep(100)}throw new Error(`Timed out waiting for ${url}`)}
async function api(url,{method='GET',body,cookie,csrf}={}){const h={'content-type':'application/json'};if(cookie)h.cookie=cookie;if(csrf)h['x-csrf-token']=csrf;const r=await fetch(APP_API+url,{method,headers:h,body:body?JSON.stringify(body):undefined});const data=await r.json();return {r,data,cookie:r.headers.get('set-cookie')?.split(';')[0]}}
let ws,id=0,pending=new Map(),exceptions=[];
function cmd(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));setTimeout(()=>{if(pending.has(n)){pending.delete(n);reject(new Error(`CDP timeout: ${method}`))}},10000)})}
async function evalJs(expression){const r=await cmd('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text||'Browser evaluation failed');return r.result?.result?.value}
async function ready(){for(let i=0;i<80;i++){if(await evalJs(`document.readyState==='complete'`))return;await sleep(50)}throw new Error('Page did not become ready')}
async function nav(route){await cmd('Page.navigate',{url:APP+route});await ready();await sleep(180)}
async function waitJs(expression,tries=60){for(let i=0;i<tries;i++){if(await evalJs(expression))return true;await sleep(100)}return false}
async function main(){
 await wait(APP_API+'/api/health');
 await wait(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
 const targets=await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();const target=targets.find(x=>x.webSocketDebuggerUrl);if(!target)throw new Error('No Chromium debugging target.');
 ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});ws.addEventListener('error',rej,{once:true})});
 ws.addEventListener('message',e=>{const m=JSON.parse(String(e.data));if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);return m.error?p.reject(new Error(m.error.message)):p.resolve(m)}if(m.method==='Runtime.exceptionThrown')exceptions.push(m.params.exceptionDetails?.text||'Runtime exception');if(m.method==='Log.entryAdded'&&m.params.entry?.level==='error')exceptions.push(m.params.entry.text)});
 await cmd('Page.enable');await cmd('Runtime.enable');await cmd('Network.enable');await cmd('Log.enable');
 const suffix=Date.now().toString().slice(-7),reg=await api('/api/auth/register',{method:'POST',body:{name:'Browser QA',username:`browser${suffix}`,email:`browser${suffix}@example.test`,password:'Password123!'}});if(reg.r.status!==201)throw new Error(`Registration failed: ${reg.r.status}`);const cookie=reg.cookie,csrf=reg.data.data.csrfToken,token=cookie.split('=')[1];
 await api('/api/auth/onboarding',{method:'POST',cookie,csrf,body:{dietary:[],cuisines:['Nigerian'],allergens:[],aiDetail:'balanced'}});
 const list=await api('/api/shopping-lists',{method:'POST',cookie,csrf,body:{name:'Browser groceries',description:'Browser QA'}});if(list.r.status!==201)throw new Error('Could not create browser shopping list.');
 await cmd('Network.setCookie',{name:'fs_session',value:decodeURIComponent(token),url:APP,httpOnly:true,sameSite:'Lax'});
 await cmd('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await nav('/app/atlas');
 const blocked=await evalJs(`location.href.startsWith('chrome-error://')&&/blocked|organization/i.test(document.body?.textContent||'')`);if(blocked){const msg='Chromium browser smoke skipped because this environment blocks local test URLs by browser policy.';if(process.env.FOODSNAP_BROWSER_REQUIRED==='1')throw new Error(msg);console.warn(msg);return}
 if(!await waitJs(`document.querySelectorAll('.atlas-region').length>0`))throw new Error('Cuisine Atlas did not finish rendering. '+JSON.stringify(await evalJs(`({href:location.href,title:document.title,body:document.body?.textContent?.slice(0,220)||'',app:document.querySelector('#app')?.textContent?.slice(0,220)||''})`)));
 const atlas=await evalJs(`({overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,regions:document.querySelectorAll('.atlas-region').length,cards:document.querySelectorAll('.atlas-cuisine').length})`);if(atlas.overflow)throw new Error('Cuisine Atlas overflows horizontally at desktop width.');if(!atlas.regions||!atlas.cards)throw new Error('Cuisine Atlas did not render region/cuisine content.');
 await cmd('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await nav('/app/atlas');await waitJs(`document.querySelectorAll('.atlas-region').length>0`);if(await evalJs(`document.documentElement.scrollWidth>document.documentElement.clientWidth`))throw new Error('Cuisine Atlas overflows horizontally at 390px.');
 await cmd('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});await nav(`/app/shopping?list=${list.data.data.id}`);
 const edit=await evalJs(`(()=>{const b=document.querySelector('[data-action="edit-shopping-list"]');if(!b)return 'missing';b.click();return 'clicked'})()`);if(edit!=='clicked')throw new Error('Edit Shopping List control is missing.');await sleep(120);const modal=await evalJs(`({exists:!!document.querySelector('#modal'),dialog:document.querySelector('#modal .modal')?.getAttribute('role'),aria:document.querySelector('#modal .modal')?.getAttribute('aria-modal'),form:!!document.querySelector('#shopping-list-edit-form')})`);if(!modal.exists||!modal.form||modal.dialog!=='dialog'||modal.aria!=='true')throw new Error('Shopping edit modal is not fully wired/accessibility-enhanced.');
 await evalJs(`document.querySelector('[data-action="close-modal"]')?.click()`);await sleep(60);await nav('/app/planner');if(!await evalJs(`!!document.querySelector('[data-action="new-meal-plan"]')`))throw new Error('Meal planner primary action is missing.');
 await nav('/app/messages');if(!await evalJs(`!!document.querySelector('.messages-layout')`))throw new Error('Messages surface did not render.');
 await nav('/app/settings');await evalJs(`document.documentElement.dataset.theme='dark'`);if(await evalJs(`document.documentElement.scrollWidth>document.documentElement.clientWidth`))throw new Error('Settings overflows in dark mode.');
 if(exceptions.length)throw new Error(`Browser console/runtime errors: ${exceptions.slice(0,5).join(' | ')}`);
 console.log('Browser smoke passed: Atlas desktop/mobile, Shopping edit modal, Planner, Messages, dark-mode layout.');
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1}).finally(()=>{try{ws?.close()}catch{};try{server.kill('SIGTERM')}catch{};try{chrome.kill('SIGTERM')}catch{};setTimeout(()=>{try{server.kill('SIGKILL')}catch{};try{chrome.kill('SIGKILL')}catch{};try{fs.rmSync(tmp,{recursive:true,force:true})}catch{}},150)});
