const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('http');
const path=require('path');
const fs=require('fs');
const {spawn}=require('child_process');

const ROOT=path.join(__dirname,'..');
const APP='http://127.0.0.1:3061';
const PROVIDER_PORT=4061;
const DB=path.join(ROOT,'data','test-foodsnap.sqlite');
let provider,child,mailPayloads=[];
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function wait(url,tries=40){for(let i=0;i<tries;i++){try{const r=await fetch(url);if(r.ok)return r}catch{}await sleep(100)}throw new Error(`Timed out waiting for ${url}`)}
async function req(url,{method='GET',body,cookie,csrf}={}){const h={'content-type':'application/json'};if(cookie)h.cookie=cookie;if(csrf)h['x-csrf-token']=csrf;const r=await fetch(APP+url,{method,headers:h,body:body?JSON.stringify(body):undefined});const data=await r.json();return {r,data,cookie:r.headers.get('set-cookie')?.split(';')[0]}}

async function login(identifier,password='Password123!'){const x=await req('/api/auth/login',{method:'POST',body:{identifier,password}});assert.equal(x.r.status,200);return {cookie:x.cookie,csrf:x.data.data.csrfToken,user:x.data.data.user}}

async function createAccount(){const suffix=Date.now().toString().slice(-7);const x=await req('/api/auth/register',{method:'POST',body:{name:'Amina Bello',username:`amina${suffix}`,email:`amina${suffix}@example.test`,password:'Password123!'}});assert.equal(x.r.status,201);return {cookie:x.cookie,csrf:x.data.data.csrfToken,user:x.data.data.user,email:`amina${suffix}@example.test`}}

test.before(async()=>{
 for(const f of [DB,DB+'-shm',DB+'-wal'])try{fs.rmSync(f,{force:true})}catch{}
 provider=http.createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;if(req.url==='/vision'){const input=JSON.parse(raw||'{}');assert.ok(input.images?.[0]?.dataUrl?.startsWith('data:image/'));res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({title:'Jollof Rice & Grilled Chicken',contentType:'prepared_dish',confidence:.93,summary:'Tomato-pepper rice with grilled chicken and ripe plantain.',cuisine:'West African',category:'Prepared meal',uncertainty:'The exact seasoning and preparation method cannot be confirmed from appearance alone.',tags:['rice','tomato','chicken','plantain'],items:[{name:'Jollof Rice',foodSlug:'jollof-rice',confidence:.96,type:'food',bbox:{x:8,y:26,w:47,h:52},notes:'Dominant rice region.',sourceType:'detected'},{name:'Chicken',confidence:.91,type:'food',bbox:{x:55,y:17,w:34,h:39},notes:'Grilled protein component.',sourceType:'detected'}],ingredients:[{name:'Rice',slug:'rice',confidence:.94,relationship:'likely',sourceType:'inferred'},{name:'Tomato',slug:'tomato',confidence:.78,relationship:'likely',sourceType:'inferred'},{name:'Chicken',slug:'chicken',confidence:.91,relationship:'visible component',sourceType:'detected'}],text:[{text:'SPECIAL MENU',confidence:.88,bbox:{x:4,y:4,w:22,h:7}}],allergens:[],relatedFoods:['jollof-rice']}))}if(req.url==='/mail'){mailPayloads.push(JSON.parse(raw||'{}'));res.writeHead(200,{'content-type':'application/json'});return res.end('{}')}res.writeHead(404);res.end()});
 await new Promise(r=>provider.listen(PROVIDER_PORT,'127.0.0.1',r));
 child=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...process.env,PORT:'3061',APP_ORIGIN:APP,FOODSNAP_DB:DB,FOODSNAP_VISION_ENDPOINT:`http://127.0.0.1:${PROVIDER_PORT}/vision`,FOODSNAP_MAIL_ENDPOINT:`http://127.0.0.1:${PROVIDER_PORT}/mail`,NODE_ENV:'test',FOODSNAP_ADMIN_EMAIL:'admin@test.foodsnap.local',FOODSNAP_ADMIN_PASSWORD:'AdminPassword123!',FOODSNAP_ADMIN_NAME:'Test Admin',FOODSNAP_ADMIN_USERNAME:'test-admin'},stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',()=>{});child.stderr.on('data',d=>{if(!String(d).includes('ExperimentalWarning'))process.stderr.write(d)});
 await wait(APP+'/api/health');
});
test.after(()=>{child?.kill();provider?.close();for(const f of [DB,DB+'-shm',DB+'-wal'])try{fs.rmSync(f,{force:true})}catch{}});

test('public knowledge is populated and app has no seeded personal account requirement',async()=>{const h=await req('/api/health');assert.equal(h.data.data.database,'sqlite');assert.equal(h.data.data.version,'1.0.0');assert.equal(h.data.data.intelligence.visionConfigured,true);const p=await req('/api/public/bootstrap');assert.ok(p.data.data.foods.length>=12);assert.ok(p.data.data.cuisines.some(x=>x.name==='West African'));assert.ok(p.data.data.cuisines.some(x=>x.name==='South Asian'));assert.ok(p.data.data.recipes.length>=5)});

test('registration, onboarding, settings and protected data stay account-scoped',async()=>{const a=await createAccount();let me=await req('/api/auth/me',{cookie:a.cookie});assert.equal(me.data.data.user.onboarding_complete,0);const onboard=await req('/api/auth/onboarding',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{dietary:['Halal-aware'],cuisines:['West African','East African'],allergens:['Peanut'],aiDetail:'deep'}});assert.equal(onboard.r.status,200);assert.equal(onboard.data.data.preferences.ai_detail,'deep');const settings=await req('/api/settings',{method:'PATCH',cookie:a.cookie,csrf:a.csrf,body:{theme:'dark',dietary:['Halal-aware'],cuisines:['West African'],allergens:['Peanut'],aiDetail:'deep',notifyScan:true,notifyDiscovery:false,dataRetention:'90d'}});assert.equal(settings.data.data.theme,'dark');const admin=await req('/api/admin/stats',{cookie:a.cookie});assert.equal(admin.r.status,403)});

test('provider-backed scan persists pipeline, detections, OCR, ingredients, knowledge and contextual assistant',async()=>{const a=await createAccount();await req('/api/auth/onboarding',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{dietary:[],cuisines:['West African'],allergens:[],aiDetail:'balanced'}});const created=await req('/api/scans',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{inputKind:'image',images:[{name:'lunch.png',dataUrl:PNG}]}});assert.equal(created.r.status,201);const id=created.data.data.id;let scan;for(let i=0;i<50;i++){await sleep(120);const x=await req(`/api/scans/${id}`,{cookie:a.cookie});scan=x.data.data;if(scan.status==='complete')break}assert.equal(scan.status,'complete');assert.equal(scan.title,'Jollof Rice & Grilled Chicken');assert.ok(scan.events.length>=8);assert.ok(scan.items.some(x=>x.name==='Jollof Rice'));assert.ok(scan.text.some(x=>x.text==='SPECIAL MENU'));assert.ok(scan.ingredients.some(x=>x.slug==='rice'));assert.ok(scan.relatedFoods.some(x=>x.slug==='jollof-rice'));const ask=await req(`/api/scans/${id}/ask`,{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{question:'What ingredients are linked to this?'}});assert.equal(ask.r.status,200);assert.match(ask.data.data.answer,/Rice/i);const save=await req('/api/saved/toggle',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{type:'scan',id}});assert.equal(save.data.data.saved,true);const history=await req('/api/scans',{cookie:a.cookie});assert.equal(history.data.data.length,1);const mediaUrl=scan.media[0].file_url;const denied=await fetch(APP+mediaUrl);assert.equal(denied.status,404);const protectedImage=await fetch(APP+mediaUrl,{headers:{cookie:a.cookie}});assert.equal(protectedImage.status,200);assert.match(protectedImage.headers.get('content-type'),/^image\//);const collection=await req('/api/collections',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{name:'Weekend cooking',description:'Things to revisit'}});assert.equal(collection.r.status,201);const added=await req(`/api/collections/${collection.data.data.id}/items`,{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{type:'scan',id}});assert.equal(added.data.data.added,true);const shared=await req('/api/share',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{type:'scan',id}});assert.equal(shared.r.status,201);const share=await req(`/api/share/${shared.data.data.token}`);assert.equal(share.data.data.item.title,'Jollof Rice & Grilled Chicken');const sharedImage=await fetch(`${APP}/api/share/${shared.data.data.token}/media/${scan.media[0].id}`);assert.equal(sharedImage.status,200)});


test('merged food knowledge, cuisines and comparison expose the broader unified catalogue',async()=>{const foods=await req('/api/foods');assert.ok(foods.data.data.items.length>=80);assert.ok(foods.data.data.items.some(x=>x.slug==='pad-thai'));assert.ok(foods.data.data.items.some(x=>/^https:\/\/images\.unsplash\.com\//.test(x.image_url)));const cmp=await req('/api/compare?left=jollof-rice&right=biryani');assert.equal(cmp.r.status,200);assert.equal(cmp.data.data.left.food.slug,'jollof-rice');assert.equal(cmp.data.data.right.food.slug,'biryani');const ghana=await req('/api/cuisines/ghanaian');assert.ok(ghana.data.data.foods.some(x=>x.slug==='waakye'));const nigeria=await req('/api/cuisines/nigerian');assert.ok(nigeria.data.data.foods.some(x=>x.slug==='suya'))});

test('password recovery uses a time-limited mail transport without account enumeration',async()=>{mailPayloads=[];const a=await createAccount();const x=await req('/api/auth/forgot-password',{method:'POST',body:{email:a.email}});assert.equal(x.r.status,200);let resetMail;for(let i=0;i<25&&!resetMail;i++){await sleep(50);resetMail=mailPayloads.find(x=>x.subject==='Reset your FoodSnap password')}assert.equal(resetMail.to,a.email);assert.match(resetMail.text,/reset-password\?token=/);const token=new URL(resetMail.text.match(/https?:\/\/\S+/)[0]).searchParams.get('token');const reset=await req('/api/auth/reset-password',{method:'POST',body:{token,password:'NewPassword123!'}});assert.equal(reset.r.status,200);const logged=await login(a.email,'NewPassword123!');assert.equal(logged.user.email,a.email)});

test('v1.0.0 compatibility routes and analytics are available after sign-in',async()=>{const food=await req('/api/foods/food-17');assert.equal(food.r.status,200);assert.equal(food.data.data.food.id,17);const recipe=await req('/api/recipes/recipe-13');assert.equal(recipe.r.status,200);assert.equal(recipe.data.data.recipe.id,13);const a=await createAccount();await req('/api/auth/onboarding',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{dietary:[],cuisines:[],allergens:[],aiDetail:'balanced'}});const analytics=await req('/api/analytics',{cookie:a.cookie});assert.equal(analytics.r.status,200);assert.equal(analytics.data.data.summary.scans,0);assert.ok(Array.isArray(analytics.data.data.daily));});


test('welcome/onboarding mail, in-app notifications, likes and comments are persisted',async()=>{mailPayloads=[];const a=await createAccount();for(let i=0;i<20&&!mailPayloads.some(x=>x.subject==='Welcome to FoodSnap');i++)await sleep(40);assert.ok(mailPayloads.some(x=>x.subject==='Welcome to FoodSnap'&&x.to===a.email));await req('/api/auth/onboarding',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{dietary:[],cuisines:['Nigerian'],allergens:[],aiDetail:'balanced'}});for(let i=0;i<20&&!mailPayloads.some(x=>x.subject==='Your FoodSnap is ready');i++)await sleep(40);assert.ok(mailPayloads.some(x=>x.subject==='Your FoodSnap is ready'&&x.to===a.email));const notes=await req('/api/notifications',{cookie:a.cookie});assert.ok(notes.data.data.items.some(x=>x.type==='welcome'));assert.ok(notes.data.data.items.some(x=>x.type==='onboarding_complete'));const foods=await req('/api/foods');const id=foods.data.data.items[0].id;let engage=await req(`/api/engagement/food/${id}`,{cookie:a.cookie});assert.equal(engage.data.data.liked,false);engage=await req(`/api/engagement/food/${id}/like`,{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{}});assert.equal(engage.data.data.liked,true);assert.ok(engage.data.data.likes>=1);engage=await req(`/api/engagement/food/${id}/comments`,{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{body:'This ingredient trail is useful for comparing related dishes.'}});assert.equal(engage.r.status,201);assert.ok(engage.data.data.comments.some(x=>/ingredient trail/i.test(x.body)));const analytics=await req('/api/analytics',{cookie:a.cookie});assert.equal(analytics.data.data.summary.likes,1);assert.equal(analytics.data.data.summary.comments,1);const comment=engage.data.data.comments.find(x=>x.user_id===a.user.id);const removed=await req(`/api/comments/${comment.id}`,{method:'DELETE',cookie:a.cookie,csrf:a.csrf,body:{}});assert.equal(removed.r.status,200)});

test('community history records likes/comments and shared scans can receive signed-in reactions',async()=>{
 const owner=await createAccount();
 await req('/api/auth/onboarding',{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{dietary:[],cuisines:['West African'],allergens:[],aiDetail:'balanced'}});
 const created=await req('/api/scans',{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{inputKind:'image',images:[{name:'shared-lunch.png',dataUrl:PNG}]}});
 assert.equal(created.r.status,201);const scanId=created.data.data.id;
 for(let i=0;i<50;i++){await sleep(120);const x=await req(`/api/scans/${scanId}`,{cookie:owner.cookie});if(x.data.data.status==='complete')break}
 const shared=await req('/api/share',{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{type:'scan',id:scanId}});assert.equal(shared.r.status,201);
 const visitor=await createAccount();
 await req('/api/auth/onboarding',{method:'POST',cookie:visitor.cookie,csrf:visitor.csrf,body:{dietary:[],cuisines:[],allergens:[],aiDetail:'balanced'}});
 let reaction=await req(`/api/engagement/scan/${scanId}/like`,{method:'POST',cookie:visitor.cookie,csrf:visitor.csrf,body:{}});assert.equal(reaction.r.status,200);assert.equal(reaction.data.data.liked,true);
 reaction=await req(`/api/engagement/scan/${scanId}/comments`,{method:'POST',cookie:visitor.cookie,csrf:visitor.csrf,body:{body:'The component breakdown makes this shared scan easy to understand.'}});assert.equal(reaction.r.status,201);
 const visitorActivity=await req('/api/community/activity',{cookie:visitor.cookie});assert.equal(visitorActivity.r.status,200);assert.ok(visitorActivity.data.data.mine.some(x=>x.kind==='like'&&x.item_type==='scan'&&x.item_id===scanId&&x.link.startsWith('/share/')));assert.ok(visitorActivity.data.data.mine.some(x=>x.kind==='comment'&&x.item_id===scanId));
 const ownerActivity=await req('/api/community/activity',{cookie:owner.cookie});assert.equal(ownerActivity.r.status,200);assert.ok(ownerActivity.data.data.received.some(x=>x.kind==='received_like'&&x.item_id===scanId));assert.ok(ownerActivity.data.data.received.some(x=>x.kind==='received_comment'&&x.item_id===scanId));
 const ownerNotes=await req('/api/notifications',{cookie:owner.cookie});assert.ok(ownerNotes.data.data.items.some(x=>x.type==='scan_like'));assert.ok(ownerNotes.data.data.items.some(x=>x.type==='scan_comment'));
});


test('scan correction, personal notes, visual discovery and trails persist together',async()=>{
 const a=await createAccount();await req('/api/auth/onboarding',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{dietary:[],cuisines:['Nigerian'],allergens:[],aiDetail:'balanced'}});
 const created=await req('/api/scans',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{inputKind:'image',images:[{name:`correction-${Date.now()}.png`,dataUrl:PNG}]}});assert.equal(created.r.status,201);const id=created.data.data.id;
 let scan;for(let i=0;i<50;i++){await sleep(120);const x=await req(`/api/scans/${id}`,{cookie:a.cookie});scan=x.data.data;if(scan.status==='complete')break}assert.equal(scan.status,'complete');
 const note=await req(`/api/scans/${id}/note`,{method:'PATCH',cookie:a.cookie,csrf:a.csrf,body:{note:'Tried after class; remember the smoky rice and ripe plantain.'}});assert.match(note.data.data.user_note,/smoky rice/i);
 const foods=await req('/api/foods?q=Jollof');const jollof=foods.data.data.items.find(x=>x.slug==='jollof-rice');assert.ok(jollof);
 const corrected=await req(`/api/scans/${id}/correction`,{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{foodId:jollof.id,note:'Confirmed from the dish context.'}});assert.equal(corrected.r.status,200);assert.equal(corrected.data.data.correction.confirmed_food_id,jollof.id);
 const visual=await req(`/api/scans/${id}/visual-search`,{cookie:a.cookie});assert.equal(visual.r.status,200);assert.ok(Array.isArray(visual.data.data.items));
 await req(`/api/foods/${jollof.slug}`,{cookie:a.cookie});const ing=await req('/api/ingredients?q=tomato');if(ing.data.data[0])await req(`/api/ingredients/${ing.data.data[0].slug}`,{cookie:a.cookie});
 const trails=await req('/api/trails',{cookie:a.cookie});assert.equal(trails.r.status,200);assert.ok(trails.data.data.some(t=>t.path.length>=1));
});

test('public profiles, following, blocking and moderation are account scoped',async()=>{
 const owner=await createAccount(),viewer=await createAccount();
 await req('/api/settings',{method:'PATCH',cookie:owner.cookie,csrf:owner.csrf,body:{profilePublic:true}});
 let profile=await req(`/api/users/${owner.user.username}`,{cookie:viewer.cookie});assert.equal(profile.r.status,200);assert.equal(profile.data.data.user.username,owner.user.username);
 let follow=await req(`/api/users/${owner.user.username}/follow`,{method:'POST',cookie:viewer.cookie,csrf:viewer.csrf,body:{}});assert.equal(follow.r.status,200);assert.equal(follow.data.data.following,true);
 const report=await req('/api/reports',{method:'POST',cookie:viewer.cookie,csrf:viewer.csrf,body:{targetType:'profile',targetId:owner.user.id,reason:'Profile review test',detail:'Integration coverage.'}});assert.equal(report.r.status,201);
 const block=await req(`/api/users/${owner.user.username}/block`,{method:'POST',cookie:viewer.cookie,csrf:viewer.csrf,body:{}});assert.equal(block.data.data.blocked,true);
 profile=await req(`/api/users/${owner.user.username}`,{cookie:viewer.cookie});assert.equal(profile.r.status,404);
});

test('collaborative collections can be edited, ordered, shared and saved',async()=>{
 const owner=await createAccount(),collab=await createAccount();
 const foods=await req('/api/foods');const food=foods.data.data.items[0];const ingredients=await req('/api/ingredients');const ingredient=ingredients.data.data[0];
 const c=await req('/api/collections',{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{name:`Shared table ${Date.now()}`,description:'Collaborative food ideas',visibility:'public'}});assert.equal(c.r.status,201);const cid=c.data.data.id;
 let x=await req(`/api/collections/${cid}/items`,{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{type:'food',id:food.id}});assert.equal(x.r.status,200);
 x=await req(`/api/collections/${cid}/collaborators`,{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{username:collab.user.username,role:'editor'}});assert.equal(x.r.status,200);
 const collabList=await req('/api/collections',{cookie:collab.cookie});assert.ok(collabList.data.data.some(v=>v.id===cid&&v.access==='editor'));
 x=await req(`/api/collections/${cid}/items`,{method:'POST',cookie:collab.cookie,csrf:collab.csrf,body:{type:'ingredient',id:ingredient.id}});assert.equal(x.r.status,200);
 x=await req(`/api/collections/${cid}/reorder`,{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{items:[{type:'ingredient',id:ingredient.id},{type:'food',id:food.id}]}});assert.equal(x.r.status,200);
 const shared=await req(`/api/collections/${cid}/share`,{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{}});assert.equal(shared.r.status,200);assert.ok(shared.data.data.token);
 const publicView=await req(`/api/public/collections/${shared.data.data.token}`);assert.equal(publicView.r.status,200);assert.equal(publicView.data.data.items.length,2);
 const saved=await req(`/api/public/collections/${shared.data.data.token}/save`,{method:'POST',cookie:collab.cookie,csrf:collab.csrf,body:{}});assert.equal(saved.r.status,200);assert.equal(saved.data.data.saved,true);
});

test('administrator studio exposes moderation, knowledge quality and provider operations',async()=>{
 const admin=await login('admin@test.foodsnap.local','AdminPassword123!');
 const studio=await req('/api/admin/studio',{cookie:admin.cookie});assert.equal(studio.r.status,200);assert.ok(studio.data.data.counts.foods>=80);assert.ok('foodsWithoutIngredients' in studio.data.data.quality);
 const operations=await req('/api/admin/operations',{cookie:admin.cookie});assert.equal(operations.r.status,200);assert.ok('jobs' in operations.data.data);assert.ok('mail' in operations.data.data);assert.ok('ai' in operations.data.data);
 const food=studio.data.data.foods[0];const alias=`Alias-${Date.now()}`;const added=await req('/api/admin/aliases',{method:'POST',cookie:admin.cookie,csrf:admin.csrf,body:{foodId:food.id,alias}});assert.equal(added.r.status,201);
});

test('PWA shell and product-depth routes are available',async()=>{
 for(const path of ['/manifest.webmanifest','/service-worker.js','/app/atlas','/app/trails','/app/admin']){const r=await fetch(APP+path);assert.equal(r.status,200,path)}
 const manifest=await (await fetch(APP+'/manifest.webmanifest')).json();assert.equal(manifest.name,'FoodSnap');assert.equal(manifest.display,'standalone');
 const atlas=await req('/api/atlas');assert.equal(atlas.r.status,200);assert.ok(atlas.data.data.total>=40);
});

test('Recipe Studio supports publishing, media, versions, ratings and Cooking Journal',async()=>{
 const a=await createAccount();await req('/api/auth/onboarding',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{dietary:[],cuisines:['Nigerian'],allergens:[],aiDetail:'balanced'}});
 const bootstrap=await req('/api/public/bootstrap');const cuisine=bootstrap.data.data.cuisines.find(x=>x.name==='Nigerian')||bootstrap.data.data.cuisines[0];
 const created=await req('/api/user-recipes',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{title:'Amina smoky tomato rice',description:'A personal rice recipe for the FoodSnap Studio.',cuisineId:cuisine.id,category:'Main dish',prepMinutes:15,cookMinutes:35,servings:4,difficulty:'Everyday',ingredients:[{name:'Rice',amount:'2 cups'},{name:'Tomato',amount:'5'}],steps:['Blend the tomato base.','Cook the rice in the sauce.'],tags:['rice','weeknight'],visibility:'public',status:'published',coverDataUrl:PNG,coverName:'tomato-rice.png'}});
 assert.equal(created.r.status,201);const rid=created.data.data.id;assert.equal(created.data.data.status,'published');assert.match(created.data.data.cover_url,/community-media/);
 const media=await req(`/api/user-recipes/${rid}/media`,{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{files:[{name:'step-1.png',dataUrl:PNG,caption:'Tomato base',stepIndex:0}]}});assert.equal(media.r.status,201);assert.equal(media.data.data.length,1);
 const updated=await req(`/api/user-recipes/${rid}`,{method:'PATCH',cookie:a.cookie,csrf:a.csrf,body:{title:'Amina smoky tomato rice — updated',changeNote:'Refined the title',status:'published',visibility:'public'}});assert.equal(updated.r.status,200);assert.match(updated.data.data.title,/updated/);
 const versions=await req(`/api/user-recipes/${rid}/versions`,{cookie:a.cookie});assert.ok(versions.data.data.length>=2);
 const rating=await req(`/api/user-recipes/${rid}/rating`,{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{rating:5,madeIt:true,review:'Would make again.'}});assert.equal(rating.r.status,200);
 const cooked=await req(`/api/user-recipes/${rid}/cooked`,{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{rating:5,wouldMakeAgain:true,note:'Added extra pepper.',photoDataUrl:PNG}});assert.equal(cooked.r.status,200);
 const journal=await req('/api/cooking-journal',{cookie:a.cookie});assert.ok(journal.data.data.some(x=>x.user_recipe_id===rid));
 const overview=await req('/api/creator/overview',{cookie:a.cookie});assert.ok(overview.data.data.recipes>=1);
});

test('Community Feed and Messages connect people around FoodSnap content',async()=>{
 const owner=await createAccount(),viewer=await createAccount();
 await req('/api/settings',{method:'PATCH',cookie:owner.cookie,csrf:owner.csrf,body:{profilePublic:true,messagePrivacy:'followers',commentPrivacy:'everyone'}});
 await req(`/api/users/${owner.user.username}/follow`,{method:'POST',cookie:viewer.cookie,csrf:viewer.csrf,body:{}});
 const post=await req('/api/posts',{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{caption:'First try at this smoky rice bowl.',postType:'food_story',visibility:'public',media:[{name:'bowl.png',type:'image',dataUrl:PNG}]}});assert.equal(post.r.status,201);const pid=post.data.data.id;
 const feed=await req('/api/feed?tab=following',{cookie:viewer.cookie});assert.ok(feed.data.data.some(x=>x.id===pid));
 let liked=await req(`/api/posts/${pid}/like`,{method:'POST',cookie:viewer.cookie,csrf:viewer.csrf,body:{}});assert.equal(liked.data.data.liked,true);
 let commented=await req(`/api/posts/${pid}/comments`,{method:'POST',cookie:viewer.cookie,csrf:viewer.csrf,body:{body:'The char on this looks great.'}});assert.equal(commented.r.status,201);const comment=commented.data.data.comments.find(x=>x.user_id===viewer.user.id);assert.ok(comment);
 const convo=await req('/api/conversations',{method:'POST',cookie:viewer.cookie,csrf:viewer.csrf,body:{username:owner.user.username}});assert.ok(convo.data.data.id);
 const sent=await req(`/api/conversations/${convo.data.data.id}/messages`,{method:'POST',cookie:viewer.cookie,csrf:viewer.csrf,body:{body:'Sending this back to you.',shareType:'post',shareId:pid}});assert.equal(sent.r.status,201);
 const thread=await req(`/api/conversations/${convo.data.data.id}/messages`,{cookie:owner.cookie});assert.ok(thread.data.data.messages.some(x=>x.body==='Sending this back to you.'&&x.share_type==='post'));
 const notes=await req('/api/notifications',{cookie:owner.cookie});assert.ok(notes.data.data.items.some(x=>['post_like','post_comment','message'].includes(x.type)));
});

test('Meal Planner connects recipes to Shopping Lists and Pantry',async()=>{
 const a=await createAccount();
 const recipes=await req('/api/recipes');const recipe=recipes.data.data.find(x=>/jollof/i.test(x.title))||recipes.data.data[0];assert.ok(recipe);
 const pantry=await req('/api/pantry',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{name:'Rice',quantity:2,unit:'cups',note:'Already at home'}});assert.equal(pantry.r.status,201);
 const plans=await req('/api/meal-plans',{cookie:a.cookie});const plan=plans.data.data[0];assert.ok(plan);
 const entry=await req(`/api/meal-plans/${plan.id}/entries`,{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{date:plan.start_date,slot:'Dinner',recipeId:recipe.id,title:recipe.title,servings:4,note:'Family dinner'}});assert.equal(entry.r.status,201);
 const list=await req('/api/shopping-lists',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{name:`Weekly groceries ${Date.now()}`,description:'Generated from the meal plan'}});assert.equal(list.r.status,201);
 const generated=await req(`/api/shopping-lists/${list.data.data.id}/generate`,{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{mealPlanId:plan.id,missingOnly:true}});assert.equal(generated.r.status,200);assert.ok(generated.data.data.ingredients>=1);
 const lists=await req('/api/shopping-lists',{cookie:a.cookie});const current=lists.data.data.find(x=>x.id===list.data.data.id);assert.ok(current.items.length>=1);assert.ok(!current.items.some(x=>String(x.name).toLowerCase()==='rice'));
 const first=current.items[0];const checked=await req(`/api/shopping-list-items/${first.id}`,{method:'PATCH',cookie:a.cookie,csrf:a.csrf,body:{checked:true}});assert.equal(checked.data.data.checked,1);
 const matches=await req('/api/pantry/matches',{cookie:a.cookie});assert.ok(Array.isArray(matches.data.data));assert.ok(matches.data.data.length>=1);
 const cloned=await req(`/api/meal-plans/${plan.id}/duplicate`,{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{name:'Next week',startDate:'2026-09-21'}});assert.equal(cloned.r.status,201);
});

test('expanded FoodSnap route shell exposes studio, planning, community and inbox surfaces',async()=>{
 for(const route of ['/app/community','/app/my-recipes','/app/my-recipes/new','/app/planner','/app/shopping','/app/pantry','/app/journal','/app/messages','/app/creator']){const r=await fetch(APP+route);assert.equal(r.status,200,route)}
});

test('Households share meal plans, shopping lists and pantry without merging accounts',async()=>{
 const owner=await createAccount(),member=await createAccount();
 const hh=await req('/api/households',{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{name:'Bello kitchen'}});assert.equal(hh.r.status,201);const hid=hh.data.data.id;
 const joined=await req('/api/households/join',{method:'POST',cookie:member.cookie,csrf:member.csrf,body:{token:hh.data.data.inviteCode}});assert.equal(joined.r.status,200);assert.equal(joined.data.data.householdId,hid);
 const plan=await req('/api/meal-plans',{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{name:'Shared week',startDate:'2026-09-14',endDate:'2026-09-20',householdId:hid}});assert.equal(plan.r.status,201);assert.equal(plan.data.data.household_id,hid);
 const list=await req('/api/shopping-lists',{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{name:`Household groceries ${Date.now()}`,householdId:hid}});assert.equal(list.r.status,201);assert.equal(list.data.data.household_id,hid);
 const pantry=await req('/api/pantry',{method:'POST',cookie:member.cookie,csrf:member.csrf,body:{name:'Tomatoes',quantity:6,unit:'piece',householdId:hid}});assert.equal(pantry.r.status,201);assert.equal(pantry.data.data.household_id,hid);
 const memberPlans=await req('/api/meal-plans',{cookie:member.cookie});assert.ok(memberPlans.data.data.some(x=>x.id===plan.data.data.id));
 const memberLists=await req('/api/shopping-lists',{cookie:member.cookie});assert.ok(memberLists.data.data.some(x=>x.id===list.data.data.id));
 const sharedPantry=await req(`/api/pantry?householdId=${hid}`,{cookie:owner.cookie});assert.ok(sharedPantry.data.data.some(x=>x.name==='Tomatoes'));
});

test('Saved searches, message requests and cursor pagination work under production-style navigation',async()=>{
 const a=await createAccount(),b=await createAccount();
 const saved=await req('/api/saved-searches',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{name:`Rice search ${Date.now()}`,query:'rice',filters:{type:'food'}}});assert.equal(saved.r.status,201);
 const searches=await req('/api/saved-searches',{cookie:a.cookie});assert.ok(searches.data.data.some(x=>x.query==='rice'));
 const convo=await req('/api/conversations',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{username:b.user.username}});assert.equal(convo.r.status,201);const cid=convo.data.data.id;
 const pending=await req(`/api/conversations/${cid}/messages`,{method:'POST',cookie:b.cookie,csrf:b.csrf,body:{body:'Should be blocked before acceptance.'}});assert.equal(pending.r.status,409);
 const accepted=await req(`/api/conversations/${cid}/accept`,{method:'POST',cookie:b.cookie,csrf:b.csrf,body:{}});assert.equal(accepted.r.status,200);
 const sent=await req(`/api/conversations/${cid}/messages`,{method:'POST',cookie:b.cookie,csrf:b.csrf,body:{body:'Accepted — hello.'}});assert.equal(sent.r.status,201);
 const cursor=await req(`/api/conversations/${cid}/messages/cursor?limit=1`,{cookie:a.cookie});assert.equal(cursor.r.status,200);assert.equal(cursor.data.data.items.length,1);
 const search=await req('/api/search/cursor?q=rice&limit=5',{cookie:a.cookie});assert.equal(search.r.status,200);assert.ok(Array.isArray(search.data.data.items));
 const notifications=await req('/api/notifications/cursor?limit=5',{cookie:b.cookie});assert.equal(notifications.r.status,200);assert.ok(Array.isArray(notifications.data.data.items));
});

test('Account export, background jobs and administrator scale/audit endpoints are operational',async()=>{
 const a=await createAccount();const requested=await req('/api/account/export',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{}});assert.equal(requested.r.status,202);
 let exportRow=null;for(let i=0;i<50;i++){await sleep(100);const rows=await req('/api/account/exports',{cookie:a.cookie});exportRow=rows.data.data.find(x=>x.id===requested.data.data.id);if(exportRow?.status==='complete')break}assert.equal(exportRow?.status,'complete');assert.ok(exportRow.file_url);
 const admin=await login('admin@test.foodsnap.local','AdminPassword123!');
 const scale=await req('/api/admin/scale',{cookie:admin.cookie});assert.equal(scale.r.status,200);assert.equal(scale.data.data.walMode,'wal');assert.ok(scale.data.data.tables.users>=1);
 const jobs=await req('/api/admin/jobs',{cookie:admin.cookie});assert.equal(jobs.r.status,200);assert.ok(jobs.data.data.stats);
 const audit=await req('/api/admin/audit?limit=10',{cookie:admin.cookie});assert.equal(audit.r.status,200);assert.ok(Array.isArray(audit.data.data));
});

test('scheduled content stays private until publication and private creator media requires authorization',async()=>{
 const owner=await createAccount(),viewer=await createAccount();
 await req('/api/settings',{method:'PATCH',cookie:owner.cookie,csrf:owner.csrf,body:{profilePublic:true}});
 const future=new Date(Date.now()+86400000).toISOString();
 const recipe=await req('/api/user-recipes',{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{title:`Private scheduled recipe ${Date.now()}`,description:'Not published yet.',ingredients:[{name:'Rice',amount:'2 cups'}],steps:['Cook it.'],visibility:'public',status:'published',scheduledAt:future,coverDataUrl:PNG,coverName:'private.png'}});assert.equal(recipe.r.status,201);assert.equal(recipe.data.data.status,'draft');const rid=recipe.data.data.id,media=recipe.data.data.cover_url;
 const ownerMedia=await fetch(APP+media,{headers:{cookie:owner.cookie}});assert.equal(ownerMedia.status,200);
 const signedOutMedia=await fetch(APP+media);assert.equal(signedOutMedia.status,404);
 const viewerMedia=await fetch(APP+media,{headers:{cookie:viewer.cookie}});assert.equal(viewerMedia.status,404);
 const direct=await req(`/api/user-recipes/${rid}`,{cookie:viewer.cookie});assert.equal(direct.r.status,404);
 const post=await req('/api/posts',{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{caption:'Tomorrow food story',visibility:'public',scheduledAt:future}});assert.equal(post.r.status,201);assert.equal(post.data.data.published_at,null);
 const feed=await req('/api/feed/cursor?limit=50',{cookie:viewer.cookie});assert.ok(!feed.data.data.items.some(x=>x.id===post.data.data.id));
 const search=await req('/api/search?q=Tomorrow',{cookie:viewer.cookie});assert.ok(!search.data.data.posts.some(x=>x.id===post.data.data.id));
 const profile=await req(`/api/users/${owner.user.username}`,{cookie:viewer.cookie});assert.ok(!profile.data.data.posts.some(x=>x.id===post.data.data.id));
});

test('message delete-for-me is private to the deleting participant',async()=>{
 const a=await createAccount(),b=await createAccount();
 const convo=await req('/api/conversations',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{username:b.user.username}});const cid=convo.data.data.id;
 await req(`/api/conversations/${cid}/accept`,{method:'POST',cookie:b.cookie,csrf:b.csrf,body:{}});
 const sent=await req(`/api/conversations/${cid}/messages`,{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{body:'Only A should hide this.'}});const mid=sent.data.data.id;
 const del=await req(`/api/messages/${mid}`,{method:'DELETE',cookie:a.cookie,csrf:a.csrf});assert.equal(del.r.status,200);
 const threadA=await req(`/api/conversations/${cid}/messages`,{cookie:a.cookie});assert.ok(!threadA.data.data.messages.some(x=>x.id===mid));
 const threadB=await req(`/api/conversations/${cid}/messages`,{cookie:b.cookie});assert.ok(threadB.data.data.messages.some(x=>x.id===mid&&x.body==='Only A should hide this.'));
});

test('share links can be listed and revoked by their owner',async()=>{
 const a=await createAccount();await req('/api/auth/onboarding',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{dietary:[],cuisines:[],allergens:[],aiDetail:'balanced'}});
 const created=await req('/api/scans',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{inputKind:'image',images:[{name:`share-${Date.now()}.png`,dataUrl:PNG}]}});const id=created.data.data.id;for(let i=0;i<50;i++){await sleep(100);const x=await req(`/api/scans/${id}`,{cookie:a.cookie});if(x.data.data.status==='complete')break}
 const shared=await req('/api/share',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{type:'scan',id,expiresInDays:2}});const token=shared.data.data.token;
 const links=await req('/api/share-links',{cookie:a.cookie});assert.ok(links.data.data.some(x=>x.token===token));
 assert.equal((await req(`/api/share/${token}`)).r.status,200);
 const revoked=await req(`/api/share-links/item/${token}`,{method:'DELETE',cookie:a.cookie,csrf:a.csrf});assert.equal(revoked.r.status,200);
 assert.equal((await req(`/api/share/${token}`)).r.status,404);
});

test('household invite lifecycle supports pause, rotation, transfer and leave',async()=>{
 const owner=await createAccount(),member=await createAccount(),third=await createAccount();
 const hh=await req('/api/households',{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{name:'Audit kitchen'}});const hid=hh.data.data.id,code=hh.data.data.inviteCode;
 const paused=await req(`/api/households/${hid}`,{method:'PATCH',cookie:owner.cookie,csrf:owner.csrf,body:{name:'Audit kitchen',inviteEnabled:false}});assert.equal(paused.data.data.invite_enabled,0);
 const denied=await req('/api/households/join',{method:'POST',cookie:member.cookie,csrf:member.csrf,body:{token:code}});assert.equal(denied.r.status,404);
 await req(`/api/households/${hid}`,{method:'PATCH',cookie:owner.cookie,csrf:owner.csrf,body:{inviteEnabled:true}});
 const rotated=await req(`/api/households/${hid}/invite-code/rotate`,{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{}});assert.notEqual(rotated.data.data.inviteCode,code);
 const joined=await req('/api/households/join',{method:'POST',cookie:member.cookie,csrf:member.csrf,body:{token:rotated.data.data.inviteCode}});assert.equal(joined.r.status,200);
 await req('/api/households/join',{method:'POST',cookie:third.cookie,csrf:third.csrf,body:{token:rotated.data.data.inviteCode}});
 const transfer=await req(`/api/households/${hid}/transfer`,{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{userId:member.user.id}});assert.equal(transfer.r.status,200);
 const leave=await req(`/api/households/${hid}/leave`,{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{}});assert.equal(leave.r.status,200);
 const view=await req('/api/households',{cookie:member.cookie});assert.equal(view.data.data.find(x=>x.id===hid).role,'owner');
});

test('knowledge provenance, Atlas hierarchy and FTS-backed personal search are populated',async()=>{
 const a=await createAccount();
 const food=await req('/api/foods/jollof-rice',{cookie:a.cookie});assert.ok(food.data.data.sources.length>=1);assert.ok(food.data.data.sources[0].source_name);
 const atlas=await req('/api/atlas');assert.ok(atlas.data.data.hierarchy.Africa);assert.ok(Object.keys(atlas.data.data.hierarchy.Africa).length>=2);
 const recipe=await req('/api/user-recipes',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{title:`Cassava midnight stew ${Date.now()}`,description:'A searchable creator recipe.',ingredients:[{name:'Cassava',amount:'1'}],steps:['Cook.'],visibility:'public',status:'published'}});assert.equal(recipe.r.status,201);
 const admin=await login('admin@test.foodsnap.local','AdminPassword123!');await req('/api/admin/search-rebuild',{method:'POST',cookie:admin.cookie,csrf:admin.csrf,body:{}});for(let i=0;i<20;i++){await sleep(80);const search=await req('/api/search?q=Cassava midnight',{cookie:a.cookie});if(search.data.data.userRecipes.some(x=>x.id===recipe.data.data.id))return}assert.fail('Creator recipe was not indexed by FTS');
});

test('frontend audit contracts keep critical helpers and accessible dialogs wired',async()=>{
 const js=fs.readFileSync(path.join(ROOT,'public','app.js'),'utf8');
 assert.match(js,/async function openEditShoppingList\(/);
 assert.match(js,/function enhanceModal\(/);
 assert.match(js,/aria-modal/);
 assert.match(js,/flushOfflineMutations/);
 assert.doesNotMatch(js,/openEditShoppingList\([^)]*\).*function openEditShoppingList\s*=\s*undefined/);
});

test('community feed keeps comment-heavy posts compact while full thread remains available',async()=>{
 const owner=await createAccount(),viewer=await createAccount();
 await req('/api/settings',{method:'PATCH',cookie:owner.cookie,csrf:owner.csrf,body:{profilePublic:true,commentPrivacy:'everyone'}});
 const post=await req('/api/posts',{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{caption:`Compact feed thread ${Date.now()}`,postType:'food_story',visibility:'public'}});assert.equal(post.r.status,201);const pid=post.data.data.id;
 for(let i=0;i<6;i++){const x=await req(`/api/posts/${pid}/comments`,{method:'POST',cookie:viewer.cookie,csrf:viewer.csrf,body:{body:`Seeded discussion comment ${i+1}`}});assert.equal(x.r.status,201)}
 const feed=await req('/api/feed/cursor?limit=50',{cookie:viewer.cookie}),row=feed.data.data.items.find(x=>x.id===pid);assert.ok(row);assert.equal(row.comment_count,6);assert.ok(row.comments.length<=2);
 const full=await req(`/api/posts/${pid}`,{cookie:viewer.cookie});assert.equal(full.r.status,200);assert.equal(full.data.data.comments.filter(x=>!x.deleted_at).length,6);
});

test('message discovery searches names and @usernames and conversation creation accepts @ prefixes',async()=>{
 const owner=await createAccount(),viewer=await createAccount();
 await req('/api/settings',{method:'PATCH',cookie:owner.cookie,csrf:owner.csrf,body:{profilePublic:true,messagePrivacy:'everyone'}});
 const discovered=await req(`/api/users/discover?q=${encodeURIComponent('@'+owner.user.username)}&limit=20`,{cookie:viewer.cookie});assert.equal(discovered.r.status,200);assert.ok(discovered.data.data.some(x=>x.username===owner.user.username&&x.can_message));
 const convo=await req('/api/conversations',{method:'POST',cookie:viewer.cookie,csrf:viewer.csrf,body:{username:'@'+owner.user.username}});assert.ok([200,201].includes(convo.r.status));assert.ok(convo.data.data.id);
 const sent=await req(`/api/conversations/${convo.data.data.id}/messages`,{method:'POST',cookie:viewer.cookie,csrf:viewer.csrf,body:{body:'Username discovery works.'}});assert.equal(sent.r.status,201);
});

test('own profile exposes follower/following and community engagement counts',async()=>{
 const owner=await createAccount(),viewer=await createAccount();
 await req('/api/settings',{method:'PATCH',cookie:owner.cookie,csrf:owner.csrf,body:{profilePublic:true,messagePrivacy:'everyone'}});
 await req(`/api/users/${owner.user.username}/follow`,{method:'POST',cookie:viewer.cookie,csrf:viewer.csrf,body:{}});
 const post=await req('/api/posts',{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{caption:'Profile count target',visibility:'public'}});const pid=post.data.data.id;
 await req(`/api/posts/${pid}/like`,{method:'POST',cookie:viewer.cookie,csrf:viewer.csrf,body:{}});await req(`/api/posts/${pid}/comments`,{method:'POST',cookie:viewer.cookie,csrf:viewer.csrf,body:{body:'Count me.'}});
 const profile=await req('/api/profile',{cookie:owner.cookie});assert.equal(profile.r.status,200);assert.ok(profile.data.data.counts.followers>=1);assert.ok(profile.data.data.counts.postLikesReceived>=1);assert.ok(profile.data.data.counts.postCommentsReceived>=1);assert.ok(profile.data.data.followers.some(x=>x.username===viewer.user.username));
 const viewerProfile=await req('/api/profile',{cookie:viewer.cookie});assert.ok(viewerProfile.data.data.counts.following>=1);assert.ok(viewerProfile.data.data.following.some(x=>x.username===owner.user.username));
});

test('account exports support JSON, CSV, PDF and Word downloads without expanding settings indefinitely',async()=>{
 const a=await createAccount();const expected={json:/application\/json/i,csv:/text\/csv/i,pdf:/application\/pdf/i,doc:/application\/msword/i};
 for(const format of Object.keys(expected)){const requested=await req('/api/account/export',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{format}});assert.equal(requested.r.status,202)}
 let rows=[];for(let i=0;i<90;i++){await sleep(120);const x=await req('/api/account/exports',{cookie:a.cookie});rows=x.data.data;if(Object.keys(expected).every(format=>rows.some(r=>r.export_format===format&&r.status==='complete')))break}
 for(const [format,re] of Object.entries(expected)){const row=rows.find(r=>r.export_format===format&&r.status==='complete');assert.ok(row,`${format} export completed`);const dl=await fetch(APP+row.file_url,{headers:{cookie:a.cookie}});assert.equal(dl.status,200);assert.match(dl.headers.get('content-type')||'',re);const buf=Buffer.from(await dl.arrayBuffer());assert.ok(buf.length>20);if(format==='pdf')assert.equal(buf.subarray(0,4).toString(),'%PDF')}
 assert.ok(rows.length<=10);
});

test('frontend continuity contracts use custom dialogs, persistent sidebar and real month calendar',()=>{
 const js=fs.readFileSync(path.join(ROOT,'public','app.js'),'utf8'),css=fs.readFileSync(path.join(ROOT,'public','styles.css'),'utf8');
 assert.match(js,/function decisionDialog|const confirmDialog=/);assert.doesNotMatch(js,/\b(?:window\.)?confirm\s*\(/);assert.doesNotMatch(js,/\b(?:window\.)?prompt\s*\(/);assert.match(js,/fs-sidebar-scroll/);assert.match(js,/plannerMonthCells/);assert.match(js,/meal-month-grid/);assert.match(js,/users\/discover/);assert.match(js,/Create FoodSnap post/);assert.match(css,/\.meal-month-calendar/);assert.match(css,/\.export-history/);assert.match(css,/\.message-person-list/);
});

test('messaging UI opens to the inbox, constrains media and previews selected attachments',()=>{
 const js=fs.readFileSync(path.join(ROOT,'public','app.js'),'utf8'),css=fs.readFileSync(path.join(ROOT,'public','styles.css'),'utf8');
 assert.match(js,/const convoData=await api\('\/api\/conversations\?limit=60'\),conversations=convoData\.items\|\|\[\],active=Number\(conversationId\|\|0\)/);
 assert.doesNotMatch(js,/conversationId\|\|conversations\[0\]\?\.id/);
 assert.match(js,/message-media-preview/);assert.match(js,/messageDraftFiles/);assert.match(js,/remove-message-draft-media/);
 assert.match(css,/\.message-stream\{[^}]*overflow-y:auto/);assert.match(css,/\.message-attachments[^}]*max-width:320px/);assert.match(css,/\.message-bubble-action/);
});

test('realtime notifications do not replay old events on a fresh connection',()=>{
 const server=fs.readFileSync(path.join(ROOT,'server.js'),'utf8'),js=fs.readFileSync(path.join(ROOT,'public','app.js'),'utf8');
 assert.match(server,/SELECT COALESCE\(MAX\(id\),0\) id FROM realtime_events WHERE user_id=\?/);
 assert.match(server,/if\(!supplied\)\{last=/);assert.match(server,/if\(supplied\)sync\(\)/);
 assert.match(js,/fs-realtime-last/);assert.match(js,/fs-notification-/);assert.match(js,/data-toast-key/);
});

test('creator overview returns recent content and publishing status counts',async()=>{
 const a=await createAccount();
 const recipe=await req('/api/user-recipes',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{title:`Creator dashboard recipe ${Date.now()}`,ingredients:[{name:'Rice',amount:'1 cup'}],steps:['Cook.'],visibility:'private',status:'draft'}});assert.equal(recipe.r.status,201);
 const post=await req('/api/posts',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{caption:'Creator dashboard post',visibility:'public'}});assert.equal(post.r.status,201);
 const d=await req('/api/creator/overview',{cookie:a.cookie});assert.equal(d.r.status,200);assert.ok(Array.isArray(d.data.data.recentRecipes));assert.ok(Array.isArray(d.data.data.recentPosts));assert.ok(d.data.data.recentRecipes.some(x=>x.id===recipe.data.data.id));assert.ok(d.data.data.recentPosts.some(x=>x.id===post.data.data.id));assert.ok('drafts' in d.data.data);assert.ok('scheduledPosts' in d.data.data);
});

test('comments and report dialogs use structured FoodSnap modal titles instead of concatenated labels',()=>{
 const js=fs.readFileSync(path.join(ROOT,'public','app.js'),'utf8'),css=fs.readFileSync(path.join(ROOT,'public','styles.css'),'utf8');
 assert.match(js,/modal-title-block/);assert.match(js,/post-comment-compose-row/);assert.match(js,/report-modal/);assert.match(js,/Reports are reviewed privately|reviewed privately/);
 assert.match(css,/\.modal-title-block h2/);assert.match(css,/\.post-comments-modal/);assert.match(css,/\.report-privacy-note/);
});

test('messages can be edited by their sender and forwarded to another conversation',async()=>{
 const sender=await createAccount(),first=await createAccount(),second=await createAccount();
 const c1=await req('/api/conversations',{method:'POST',cookie:sender.cookie,csrf:sender.csrf,body:{username:first.user.username}});assert.equal(c1.r.status,201);
 const sent=await req(`/api/conversations/${c1.data.data.id}/messages`,{method:'POST',cookie:sender.cookie,csrf:sender.csrf,body:{body:'Original dinner idea'}});assert.equal(sent.r.status,201);const mid=sent.data.data.id;
 const edited=await req(`/api/messages/${mid}`,{method:'PATCH',cookie:sender.cookie,csrf:sender.csrf,body:{body:'Updated dinner idea'}});assert.equal(edited.r.status,200);assert.equal(edited.data.data.body,'Updated dinner idea');assert.ok(edited.data.data.edited_at);
 const denied=await req(`/api/messages/${mid}`,{method:'PATCH',cookie:first.cookie,csrf:first.csrf,body:{body:'I should not edit this'}});assert.equal(denied.r.status,403);
 const c2=await req('/api/conversations',{method:'POST',cookie:sender.cookie,csrf:sender.csrf,body:{username:second.user.username}});assert.equal(c2.r.status,201);
 const forwarded=await req(`/api/messages/${mid}/forward`,{method:'POST',cookie:sender.cookie,csrf:sender.csrf,body:{conversationId:c2.data.data.id}});assert.equal(forwarded.r.status,201);
 const thread=await req(`/api/conversations/${c2.data.data.id}/messages`,{cookie:second.cookie});const copy=thread.data.data.messages.find(x=>x.id===forwarded.data.data.id);assert.ok(copy);assert.equal(copy.body,'Updated dinner idea');assert.equal(copy.forwarded_from_id,mid);
});

test('search and shared post links deep-link to the exact Food story instead of generic Feed',async()=>{
 const js=fs.readFileSync(path.join(ROOT,'public','app.js'),'utf8');
 assert.match(js,/href="\/app\/posts\/\$\{p\.id\}"/);
 assert.match(js,/renderPostDetail\(Number\(p\.split\('\/'\)\.pop\(\)\)\)/);
 assert.match(js,/if\(m\.share_type==='post'\)return `\/app\/posts\/\$\{m\.share_id\}`/);
 const a=await createAccount();const post=await req('/api/posts',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{caption:'Search deep link dinner story',visibility:'public',postType:'food_story'}});assert.equal(post.r.status,201);
 const direct=await req(`/api/posts/${post.data.data.id}`,{cookie:a.cookie});assert.equal(direct.r.status,200);assert.equal(direct.data.data.id,post.data.data.id);
 const shell=await fetch(APP+`/app/posts/${post.data.data.id}`);assert.equal(shell.status,200);
});

test('realtime mutation bus publishes community sync events to active sessions',async()=>{
 const owner=await createAccount(),viewer=await createAccount();
 await req('/api/auth/onboarding',{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{dietary:[],cuisines:[],allergens:[],aiDetail:'balanced'}});
 await req('/api/auth/onboarding',{method:'POST',cookie:viewer.cookie,csrf:viewer.csrf,body:{dietary:[],cuisines:[],allergens:[],aiDetail:'balanced'}});
 const post=await req('/api/posts',{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{caption:'Realtime food story test',postType:'food_story',visibility:'public'}});assert.equal(post.r.status,201);
 const liked=await req(`/api/posts/${post.data.data.id}/like`,{method:'POST',cookie:viewer.cookie,csrf:viewer.csrf,body:{}});assert.equal(liked.r.status,200);
 await sleep(40);
 const {createDatabase}=require('../lib/sqlite'),liveDb=createDatabase(DB);try{const rows=liveDb.prepare("SELECT payload_json FROM realtime_events WHERE user_id=? AND event_type='sync' ORDER BY id DESC LIMIT 20").all(owner.user.id).map(x=>JSON.parse(x.payload_json));assert.ok(rows.some(x=>x.domain==='community'&&Number(x.entityId)===Number(post.data.data.id)))}finally{liveDb.close?.()}
});

test('frontend realtime orchestration refreshes messages, search, scans, processes and engagement without manual page reloads',()=>{
 const appSource=fs.readFileSync(path.join(ROOT,'public','app.js'),'utf8'),serverSource=fs.readFileSync(path.join(ROOT,'server.js'),'utf8');
 for(const eventName of ['sync','scan','process','message','notification'])assert.match(appSource,new RegExp(`addEventListener\\('${eventName}'`));
 for(const helper of ['scheduleLiveRefresh','refreshPostLive','refreshSearchLive','refreshNotificationsLive'])assert.match(appSource,new RegExp(`function ${helper}\\(`));
 assert.match(appSource,/x-foodsnap-client-id/);assert.match(serverSource,/function emitMutationSync\(/);assert.match(serverSource,/function emitActive\(/);assert.match(serverSource,/emitUser\(scan\.user_id,'scan'/);assert.match(serverSource,/kind:'export',status:'complete'/);
});

test('group chats support avatars, roles, reactions, replies and shared group history',async()=>{
 const owner=await createAccount(),member=await createAccount(),third=await createAccount();
 const group=await req('/api/conversations/groups',{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{title:'Weekend Food Crew',description:'Plan and share the weekend table.',usernames:[member.user.username,third.user.username],avatarDataUrl:PNG,avatarName:'crew.png'}});assert.equal(group.r.status,201);const gid=group.data.data.id;
 let thread=await req(`/api/conversations/${gid}/messages`,{cookie:member.cookie});assert.equal(thread.r.status,200);assert.equal(thread.data.data.conversation.is_group,1);assert.match(thread.data.data.conversation.avatar_url,/community-media/);assert.equal(thread.data.data.members.length,3);
 const first=await req(`/api/conversations/${gid}/messages`,{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{body:'Who is cooking jollof tonight?'}});assert.equal(first.r.status,201);
 const reply=await req(`/api/conversations/${gid}/messages`,{method:'POST',cookie:member.cookie,csrf:member.csrf,body:{body:'I can handle the rice.',replyToId:first.data.data.id}});assert.equal(reply.r.status,201);
 const reaction=await req(`/api/messages/${first.data.data.id}/reactions`,{method:'POST',cookie:third.cookie,csrf:third.csrf,body:{emoji:'🔥'}});assert.equal(reaction.r.status,200);assert.equal(reaction.data.data.reacted,true);
 const role=await req(`/api/conversations/${gid}/members/${member.user.id}`,{method:'PATCH',cookie:owner.cookie,csrf:owner.csrf,body:{role:'admin'}});assert.equal(role.r.status,200);assert.equal(role.data.data.role,'admin');
 thread=await req(`/api/conversations/${gid}/messages`,{cookie:owner.cookie});const replied=thread.data.data.messages.find(x=>x.id===reply.data.data.id);assert.ok(replied?.reply);assert.equal(replied.reply.id,first.data.data.id);assert.ok(thread.data.data.messages.find(x=>x.id===first.data.data.id).reactions.some(x=>x.emoji==='🔥'));
});

test('complete ZIP export contains account data and owned media without external runtime dependencies',async()=>{
 const a=await createAccount();const recipe=await req('/api/user-recipes',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{title:'Archive test recipe',ingredients:[['Rice','1 cup']],steps:['Cook.'],visibility:'private',status:'draft',coverDataUrl:PNG,coverName:'archive-cover.png'}});assert.equal(recipe.r.status,201);
 const requested=await req('/api/account/export',{method:'POST',cookie:a.cookie,csrf:a.csrf,body:{format:'zip'}});assert.equal(requested.r.status,202);
 let row=null;for(let i=0;i<100;i++){await sleep(100);const x=await req('/api/account/exports',{cookie:a.cookie});row=x.data.data.find(r=>r.id===requested.data.data.id);if(row?.status==='complete')break}assert.equal(row?.status,'complete');
 const dl=await fetch(APP+row.file_url,{headers:{cookie:a.cookie}});assert.equal(dl.status,200);assert.match(dl.headers.get('content-type')||'',/application\/zip/i);const buf=Buffer.from(await dl.arrayBuffer());assert.equal(buf.readUInt32LE(0),0x04034b50);assert.ok(buf.includes(Buffer.from('account.json')));assert.ok(buf.includes(Buffer.from('media-manifest.json')));
});

test('administrator can review uploaded media and rejected media is hidden from other users',async()=>{
 const owner=await createAccount(),viewer=await createAccount();const post=await req('/api/posts',{method:'POST',cookie:owner.cookie,csrf:owner.csrf,body:{caption:'Moderation media test',visibility:'public',media:[{name:'moderate.png',type:'image',dataUrl:PNG}]}});assert.equal(post.r.status,201);const mediaUrl=post.data.data.media[0].file_url;
 const admin=await login('admin@test.foodsnap.local','AdminPassword123!');const queue=await req('/api/admin/media?limit=100',{cookie:admin.cookie});assert.equal(queue.r.status,200);const asset=queue.data.data.items.find(x=>x.file_url===mediaUrl);assert.ok(asset);
 const reject=await req(`/api/admin/media/${asset.id}`,{method:'PATCH',cookie:admin.cookie,csrf:admin.csrf,body:{status:'rejected',note:'Synthetic moderation test'}});assert.equal(reject.r.status,200);
 const ownerMedia=await fetch(APP+mediaUrl,{headers:{cookie:owner.cookie}});assert.equal(ownerMedia.status,200);const viewerMedia=await fetch(APP+mediaUrl,{headers:{cookie:viewer.cookie}});assert.equal(viewerMedia.status,404);
});

test('final maturity UI exposes full-width composer, polished handles, group chat and media moderation contracts',()=>{
 const js=fs.readFileSync(path.join(ROOT,'public','app.js'),'utf8'),css=fs.readFileSync(path.join(ROOT,'public','styles.css'),'utf8');
 assert.match(js,/Create group chat/);assert.match(js,/group-avatar-file/);assert.match(js,/message-reaction-quick/);assert.match(js,/Starred messages/);assert.match(js,/typing/);assert.match(js,/ZIP \+ media/);assert.match(js,/admin-media-grid/);
 assert.match(css,/\.message-compose-editor textarea\{[^}]*width:100%/);assert.match(css,/min-height:112px/);assert.match(css,/\.search-story-author[^}]*flex-wrap:nowrap/);assert.match(css,/\.group-avatar-picker/);assert.match(css,/\.admin-media-grid/);
});
