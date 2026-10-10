const {db,j,slugify} = require('../lib/db');

const VISION_ENDPOINT = process.env.FOODSNAP_VISION_ENDPOINT || '';
const VISION_TOKEN = process.env.FOODSNAP_VISION_TOKEN || '';
const ASSISTANT_ENDPOINT = process.env.FOODSNAP_ASSISTANT_ENDPOINT || '';
const ASSISTANT_TOKEN = process.env.FOODSNAP_ASSISTANT_TOKEN || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_VISION_MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-5.6-luna';
const OPENAI_ASSISTANT_MODEL = process.env.OPENAI_ASSISTANT_MODEL || OPENAI_VISION_MODEL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-3.1-flash-lite';
const GEMINI_ASSISTANT_MODEL = process.env.GEMINI_ASSISTANT_MODEL || GEMINI_VISION_MODEL;

const STAGES = [
 ['media_validation','Media validated','The image is readable and ready for analysis.'],
 ['vision_analysis','Analyzing visual structure','FoodSnap is locating visually distinct regions and objects.'],
 ['text_extraction','Reading visible text','FoodSnap is extracting readable text where it is present.'],
 ['food_detection','Identifying food','Detected regions are being compared with food concepts.'],
 ['component_detection','Separating components','FoodSnap is isolating multiple foods and visible components.'],
 ['context_classification','Understanding context','The image is being classified as a dish, package, menu, recipe or mixed food scene.'],
 ['knowledge_retrieval','Matching food knowledge','Detected concepts are being linked to FoodSnap foods, ingredients and recipes.'],
 ['result_synthesis','Assembling the result','Confidence, uncertainty and supporting evidence are being combined.']
];

function available(){ return Boolean(VISION_ENDPOINT || OPENAI_API_KEY || GEMINI_API_KEY); }
function assistantAvailable(){ return Boolean(ASSISTANT_ENDPOINT || OPENAI_API_KEY || GEMINI_API_KEY); }
function providerInfo(feature='vision'){
  if(feature==='assistant'){
    if(ASSISTANT_ENDPOINT)return {provider:'custom',model:'foodsnap-assistant'};
    if(OPENAI_API_KEY)return {provider:'openai',model:OPENAI_ASSISTANT_MODEL};
    if(GEMINI_API_KEY)return {provider:'gemini',model:GEMINI_ASSISTANT_MODEL};
    return {provider:'unconfigured',model:''};
  }
  if(VISION_ENDPOINT)return {provider:'custom',model:'foodsnap-vision'};
  if(OPENAI_API_KEY)return {provider:'openai',model:OPENAI_VISION_MODEL};
  if(GEMINI_API_KEY)return {provider:'gemini',model:GEMINI_VISION_MODEL};
  return {provider:'unconfigured',model:''};
}

function normalize(raw={}){
  const identification = raw.identification || raw.food || {};
  const title = String(raw.title || identification.name || 'Food analysis').slice(0,140);
  const confidence = Math.max(0,Math.min(1,Number(raw.confidence ?? identification.confidence ?? 0)));
  const contentType = String(raw.contentType || raw.content_type || 'food_photo').slice(0,50);
  const items = Array.isArray(raw.items)?raw.items:[];
  const ingredients = Array.isArray(raw.ingredients)?raw.ingredients:[];
  const text = Array.isArray(raw.text)?raw.text:Array.isArray(raw.ocr)?raw.ocr:[];
  const allergens = Array.isArray(raw.allergens)?raw.allergens:[];
  return {
    title, confidence, contentType,
    confidenceLabel: confidence>=.85?'High':confidence>=.6?'Medium':confidence>0?'Low':'Unknown',
    summary:String(raw.summary || identification.description || '').slice(0,2500),
    cuisine:String(raw.cuisine || identification.cuisine || '').slice(0,120),
    category:String(raw.category || identification.category || '').slice(0,120),
    uncertainty:String(raw.uncertainty || '').slice(0,1500),
    tags:(Array.isArray(raw.tags)?raw.tags:[]).slice(0,30).map(x=>String(x).slice(0,60)),
    items:items.slice(0,30).map(x=>({
      name:String(x.name||'Detected item').slice(0,140), confidence:Math.max(0,Math.min(1,Number(x.confidence||0))),
      type:String(x.type||'food').slice(0,60), bbox:x.bbox||{}, notes:String(x.notes||'').slice(0,700),
      sourceType:String(x.sourceType||x.source_type||'inferred').slice(0,40), foodSlug:String(x.foodSlug||x.food_slug||'').slice(0,100)
    })),
    ingredients:ingredients.slice(0,40).map(x=>typeof x==='string'?{name:x,confidence:0.5,relationship:'possible',sourceType:'inferred'}:{
      name:String(x.name||x.slug||'').slice(0,120), slug:String(x.slug||slugify(x.name||'')).slice(0,100),
      confidence:Math.max(0,Math.min(1,Number(x.confidence||0))), relationship:String(x.relationship||'possible').slice(0,50),
      sourceType:String(x.sourceType||x.source_type||'inferred').slice(0,40)
    }).filter(x=>x.name),
    text:text.slice(0,60).map(x=>typeof x==='string'?{text:x,confidence:.8,bbox:{}}:{text:String(x.text||'').slice(0,1200),confidence:Number(x.confidence||0),bbox:x.bbox||{}}).filter(x=>x.text),
    allergens:allergens.slice(0,30).map(x=>typeof x==='string'?{name:x,basis:'Potentially associated with detected content',confidence:.4,sourceType:'inferred'}:{name:String(x.name||'').slice(0,100),basis:String(x.basis||'').slice(0,500),confidence:Number(x.confidence||0),sourceType:String(x.sourceType||x.source_type||'inferred')}).filter(x=>x.name),
    relatedFoods:(Array.isArray(raw.relatedFoods)?raw.relatedFoods:raw.related_foods||[]).slice(0,20),
    relatedRecipes:(Array.isArray(raw.relatedRecipes)?raw.relatedRecipes:raw.related_recipes||[]).slice(0,20)
  };
}


const OPENAI_SCHEMA={type:'object',additionalProperties:false,properties:{title:{type:'string'},summary:{type:'string'},confidence:{type:'number',minimum:0,maximum:1},contentType:{type:'string'},cuisine:{type:'string'},category:{type:'string'},uncertainty:{type:'string'},tags:{type:'array',items:{type:'string'}},items:{type:'array',items:{type:'object',additionalProperties:false,properties:{name:{type:'string'},confidence:{type:'number'},type:{type:'string'},bbox:{type:'object',additionalProperties:false,properties:{x:{type:'number'},y:{type:'number'},w:{type:'number'},h:{type:'number'}},required:['x','y','w','h']},notes:{type:'string'},sourceType:{type:'string'},foodSlug:{type:'string'}},required:['name','confidence','type','bbox','notes','sourceType','foodSlug']}},ingredients:{type:'array',items:{type:'object',additionalProperties:false,properties:{name:{type:'string'},slug:{type:'string'},confidence:{type:'number'},relationship:{type:'string'},sourceType:{type:'string'}},required:['name','slug','confidence','relationship','sourceType']}},text:{type:'array',items:{type:'object',additionalProperties:false,properties:{text:{type:'string'},confidence:{type:'number'},bbox:{type:'object',additionalProperties:false,properties:{x:{type:'number'},y:{type:'number'},w:{type:'number'},h:{type:'number'}},required:['x','y','w','h']}},required:['text','confidence','bbox']}},allergens:{type:'array',items:{type:'object',additionalProperties:false,properties:{name:{type:'string'},basis:{type:'string'},confidence:{type:'number'},sourceType:{type:'string'}},required:['name','basis','confidence','sourceType']}},relatedFoods:{type:'array',items:{type:'string'}},relatedRecipes:{type:'array',items:{type:'string'}}},required:['title','summary','confidence','contentType','cuisine','category','uncertainty','tags','items','ingredients','text','allergens','relatedFoods','relatedRecipes']};
function outputText(json){if(json.output_text)return json.output_text;for(const item of json.output||[])for(const c of item.content||[])if(c.type==='output_text'&&c.text)return c.text;return ''}
async function openai(body){const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:`Bearer ${OPENAI_API_KEY}`,'content-type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok){const e=new Error(data?.error?.message||'Food intelligence provider failed.');e.code='PROVIDER_ERROR';throw e}return outputText(data)}
async function analyzeOpenAI({scanCode,images,preferences}){const content=[{type:'input_text',text:`Analyze these food-related images for FoodSnap scan ${scanCode}. Handle prepared dishes, multiple-food scenes, ingredients, packaged products, labels, menus, recipes and screenshots. Separate direct visual findings, OCR/extracted text, likely inference and knowledge-match suggestions. Return normalized bounding boxes as percentages 0..100 against the first image. Never invent certainty. Treat African and global foods with equal care. User result-detail preference: ${preferences?.ai_detail||'balanced'}.`}];for(const image of images)content.push({type:'input_image',image_url:image.dataUrl,detail:'high'});const text=await openai({model:OPENAI_VISION_MODEL,input:[{role:'user',content}],text:{format:{type:'json_schema',name:'foodsnap_analysis',strict:true,schema:OPENAI_SCHEMA}}});return normalize(JSON.parse(text))}

async function geminiGenerate(model,parts,{json=false}={}){
 const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
 const r=await fetch(url,{method:'POST',headers:{'x-goog-api-key':GEMINI_API_KEY,'content-type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts}],generationConfig:json?{responseMimeType:'application/json',temperature:0.2}:{temperature:0.3}})});
 const data=await r.json().catch(()=>({}));
 if(!r.ok){const e=new Error(data?.error?.message||`Gemini returned ${r.status}`);e.code='PROVIDER_ERROR';throw e}
 const text=(data.candidates?.[0]?.content?.parts||[]).map(x=>x.text||'').join('').trim();
 if(!text)throw Object.assign(new Error('Gemini returned an empty response.'),{code:'PROVIDER_ERROR'});
 return text;
}
async function analyzeGemini({scanCode,images,preferences}){
 const prompt=`Analyze these food-related images for FoodSnap scan ${scanCode}. Handle prepared dishes, multiple-food scenes, ingredients, packaged products, labels, menus, recipes and screenshots. Separate direct visual findings, OCR/extracted text, likely inference and knowledge-match suggestions. Return ONLY JSON with this exact top-level shape: {title,summary,confidence,contentType,cuisine,category,uncertainty,tags,items,ingredients,text,allergens,relatedFoods,relatedRecipes}. items must contain {name,confidence,type,bbox:{x,y,w,h},notes,sourceType,foodSlug}; ingredients must contain {name,slug,confidence,relationship,sourceType}; text must contain {text,confidence,bbox:{x,y,w,h}}; allergens must contain {name,basis,confidence,sourceType}. Bounding boxes are percentages 0..100 against the first image. Never invent certainty. Treat African and global foods with equal care. User result-detail preference: ${preferences?.ai_detail||'balanced'}.`;
 const parts=[{text:prompt}];
 for(const image of images){const m=String(image.dataUrl||'').match(/^data:([^;]+);base64,(.+)$/);if(m)parts.push({inline_data:{mime_type:m[1],data:m[2]}})}
 const text=await geminiGenerate(GEMINI_VISION_MODEL,parts,{json:true});
 return normalize(JSON.parse(text));
}
async function analyzeCustom({scanCode,images,preferences}){
  const response=await fetch(VISION_ENDPOINT,{method:'POST',headers:{'content-type':'application/json',...(VISION_TOKEN?{authorization:`Bearer ${VISION_TOKEN}`}:{})},body:JSON.stringify({version:'1.0',scanCode,images,preferences,capabilities:['vision','ocr','food_detection','components','context','uncertainty']})});
  if(!response.ok){const text=(await response.text()).slice(0,500);const e=new Error(`Food intelligence provider returned ${response.status}${text?`: ${text}`:''}`);e.code='PROVIDER_ERROR';throw e}
  return normalize(await response.json());
}
function visionProviders(){const out=[];if(VISION_ENDPOINT)out.push({name:'custom',model:'foodsnap-vision',run:analyzeCustom});if(OPENAI_API_KEY)out.push({name:'openai',model:OPENAI_VISION_MODEL,run:analyzeOpenAI});if(GEMINI_API_KEY)out.push({name:'gemini',model:GEMINI_VISION_MODEL,run:analyzeGemini});return out}
async function analyze(input){
  const providers=visionProviders();if(!providers.length){const e=new Error('Food analysis is temporarily unavailable. Please try again later.');e.code='INTELLIGENCE_UNAVAILABLE';throw e}
  const failures=[];
  for(const provider of providers){try{const result=await provider.run(input);result._provider=provider.name;result._model=provider.model;result._failovers=failures;return result}catch(e){failures.push({provider:provider.name,code:e.code||'PROVIDER_ERROR',message:String(e.message||e).slice(0,220)})}}
  const e=new Error('Food analysis providers are temporarily unavailable. Please try again later.');e.code='PROVIDER_ERROR';e.failures=failures;throw e;
}

function findKnowledge(result){
  const names=[result.title,...result.items.map(x=>x.name),...result.tags].map(x=>slugify(x)).filter(Boolean);
  const foods=[]; const seen=new Set();
  for(const n of names){
    const row=db.prepare(`SELECT f.*,c.name cuisine_name,c.slug cuisine_slug FROM foods f LEFT JOIN cuisines c ON c.id=f.cuisine_id WHERE f.slug=? OR lower(f.name)=lower(?) OR lower(f.name) LIKE lower(?) LIMIT 3`).all(n,n,`%${n.replace(/-/g,' ')}%`);
    for(const r of row)if(!seen.has(r.id)){seen.add(r.id);foods.push({...r,tags:j(r.tags_json,[])})}
  }
  for(const s of result.relatedFoods||[]){const slug=typeof s==='string'?slugify(s):slugify(s.slug||s.name||'');const r=db.prepare(`SELECT f.*,c.name cuisine_name,c.slug cuisine_slug FROM foods f LEFT JOIN cuisines c ON c.id=f.cuisine_id WHERE f.slug=?`).get(slug);if(r&&!seen.has(r.id)){seen.add(r.id);foods.push({...r,tags:j(r.tags_json,[])})}}
  const ingredients=[];const ingSeen=new Set();
  for(const x of result.ingredients){const r=db.prepare('SELECT * FROM ingredients WHERE slug=? OR lower(name)=lower(?)').get(x.slug||slugify(x.name),x.name);if(r&&!ingSeen.has(r.id)){ingSeen.add(r.id);ingredients.push({...r,tags:j(r.tags_json,[]),match:x})}}
  const recipeMap=new Map();
  for(const f of foods.slice(0,4)){
    for(const r of db.prepare(`SELECT DISTINCT r.*,c.name cuisine_name FROM recipes r LEFT JOIN cuisines c ON c.id=r.cuisine_id JOIN recipe_ingredients ri ON ri.recipe_id=r.id JOIN food_ingredients fi ON fi.ingredient_id=ri.ingredient_id WHERE fi.food_id=? LIMIT 6`).all(f.id))recipeMap.set(r.id,{...r,ingredients:j(r.ingredients_json,[]),steps:j(r.steps_json,[]),tags:j(r.tags_json,[])})
  }
  for(const i of ingredients.slice(0,6))for(const r of db.prepare(`SELECT DISTINCT r.*,c.name cuisine_name FROM recipes r LEFT JOIN cuisines c ON c.id=r.cuisine_id JOIN recipe_ingredients ri ON ri.recipe_id=r.id WHERE ri.ingredient_id=? LIMIT 6`).all(i.id))recipeMap.set(r.id,{...r,ingredients:j(r.ingredients_json,[]),steps:j(r.steps_json,[]),tags:j(r.tags_json,[])})
  return {foods:foods.slice(0,8),ingredients:ingredients.slice(0,12),recipes:[...recipeMap.values()].slice(0,8)};
}

function contextualAnswer(scan,question){
  const q=question.toLowerCase();
  const ingredients=scan.ingredients||[]; const foods=scan.relatedFoods||[]; const recipes=scan.relatedRecipes||[];
  if(/what (is|are) (this|it)|identify|what food/.test(q)) return `${scan.title}${scan.confidence?` is the strongest match at ${Math.round(scan.confidence*100)}% confidence`:''}.${scan.uncertainty_note?` ${scan.uncertainty_note}`:''}`;
  if(/ingredient/.test(q)) return ingredients.length?`FoodSnap has linked ${ingredients.map(x=>x.name).join(', ')} to this scan. Sources are marked as detected, extracted or inferred in the result.`:'No ingredient links are strong enough to show for this scan.';
  if(/similar|related food|like this/.test(q)) return foods.length?`Related foods in FoodSnap include ${foods.map(x=>x.name).join(', ')}.`:'FoodSnap has not linked a close related food yet.';
  if(/recipe|cook|make/.test(q)) return recipes.length?`Recipes connected to this result include ${recipes.map(x=>x.title).join(', ')}.`:'There is not a strong recipe match for this result yet.';
  if(/confidence|sure|certain|uncertain/.test(q)) return `The current identification confidence is ${Math.round((scan.confidence||0)*100)}%. ${scan.uncertainty_note||'FoodSnap has not recorded an additional uncertainty note.'}`;
  return null;
}

async function ask({scan,question,history=[]}){
  const local=contextualAnswer(scan,question); if(local)return {content:local,source:'context'};
  const context={title:scan.title,confidence:scan.confidence,summary:scan.summary,cuisine:scan.cuisine,category:scan.category,uncertainty:scan.uncertainty_note,items:scan.items,ingredients:scan.ingredients,extractedText:scan.text,relatedFoods:scan.relatedFoods,relatedRecipes:scan.relatedRecipes};
  const failures=[];
  if(ASSISTANT_ENDPOINT){try{const response=await fetch(ASSISTANT_ENDPOINT,{method:'POST',headers:{'content-type':'application/json',...(ASSISTANT_TOKEN?{authorization:`Bearer ${ASSISTANT_TOKEN}`}:{})},body:JSON.stringify({version:'1.0',question,history,scan:context})});if(!response.ok)throw new Error(`Custom assistant returned ${response.status}`);const data=await response.json();return {content:String(data.answer||data.content||'').slice(0,5000),source:'provider',provider:'custom'}}catch(e){failures.push({provider:'custom',message:String(e.message||e).slice(0,180)})}}
  if(OPENAI_API_KEY){try{const text=await openai({model:OPENAI_ASSISTANT_MODEL,input:[{role:'developer',content:'You are FoodSnap Intelligence. Answer only about the active scan and closely related food discovery. Distinguish image-grounded facts from inference. Be concise, useful and culturally aware.'},{role:'user',content:`Current scan:\n${JSON.stringify(context)}\n\nConversation:\n${history.map(m=>`${m.role}: ${m.content}`).join('\n')}\n\nQuestion: ${question}`} ]});return {content:String(text).slice(0,5000),source:'provider',provider:'openai'}}catch(e){failures.push({provider:'openai',message:String(e.message||e).slice(0,180)})}}
  if(GEMINI_API_KEY){try{const prompt=`You are FoodSnap Intelligence. Answer only about the active scan and closely related food discovery. Distinguish image-grounded facts from inference. Be concise, useful and culturally aware.\n\nCurrent scan:\n${JSON.stringify(context)}\n\nConversation:\n${history.map(m=>`${m.role}: ${m.content}`).join('\n')}\n\nQuestion: ${question}`;const text=await geminiGenerate(GEMINI_ASSISTANT_MODEL,[{text:prompt}]);return {content:String(text).slice(0,5000),source:'provider',provider:'gemini'}}catch(e){failures.push({provider:'gemini',message:String(e.message||e).slice(0,180)})}}
  const e=new Error(failures.length?'FoodSnap Intelligence providers are temporarily unavailable.':'FoodSnap Intelligence cannot answer that question right now. Try asking about identification, ingredients, related foods, recipes or confidence.');e.code=failures.length?'PROVIDER_ERROR':'ASSISTANT_UNAVAILABLE';e.failures=failures;throw e;
}

module.exports={STAGES,available,assistantAvailable,providerInfo,analyze,findKnowledge,ask};
