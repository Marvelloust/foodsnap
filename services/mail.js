const MAIL_ENDPOINT=process.env.FOODSNAP_MAIL_ENDPOINT||'';
const MAIL_TOKEN=process.env.FOODSNAP_MAIL_TOKEN||'';
const RESEND_API_KEY=process.env.RESEND_API_KEY||'';
const BREVO_API_KEY=process.env.BREVO_API_KEY||'';
const FROM_EMAIL=process.env.FOODSNAP_FROM_EMAIL||process.env.BREVO_SENDER_EMAIL||'';
const FROM_NAME=process.env.FOODSNAP_FROM_NAME||process.env.BREVO_SENDER_NAME||'FoodSnap';

function configured(){return Boolean(MAIL_ENDPOINT||RESEND_API_KEY||BREVO_API_KEY)}
function transportName(){if(MAIL_ENDPOINT)return 'webhook';if(RESEND_API_KEY)return 'resend';if(BREVO_API_KEY)return 'brevo';return 'console'}
function parseFrom(){
 const raw=String(FROM_EMAIL||'').trim();
 const m=raw.match(/^(.+?)\s*<([^>]+)>$/);
 return m?{name:m[1].trim(),email:m[2].trim()}:{name:FROM_NAME,email:raw};
}
async function sendMail({to,subject,text,html}){
 if(MAIL_ENDPOINT){
  const r=await fetch(MAIL_ENDPOINT,{method:'POST',headers:{'content-type':'application/json',...(MAIL_TOKEN?{authorization:`Bearer ${MAIL_TOKEN}`}:{})},body:JSON.stringify({to,subject,text,html})});
  if(!r.ok)throw new Error(`Mail transport returned ${r.status}`);return {delivered:true,transport:'webhook'};
 }
 if(RESEND_API_KEY){
  const from=FROM_EMAIL||'FoodSnap <onboarding@resend.dev>';
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${RESEND_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({from,to:[to],subject,text,html})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data?.message||`Resend returned ${r.status}`);return {delivered:true,transport:'resend',id:data.id||''};
 }
 if(BREVO_API_KEY){
  const from=parseFrom();
  if(!from.email)throw new Error('BREVO_SENDER_EMAIL or FOODSNAP_FROM_EMAIL is required when using Brevo.');
  const r=await fetch('https://api.brevo.com/v3/smtp/email',{method:'POST',headers:{'api-key':BREVO_API_KEY,'content-type':'application/json','accept':'application/json'},body:JSON.stringify({sender:{name:from.name||FROM_NAME,email:from.email},to:[{email:to}],subject,textContent:text,htmlContent:html})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data?.message||`Brevo returned ${r.status}`);return {delivered:true,transport:'brevo',id:data.messageId||''};
 }
 console.log(`[FoodSnap mail] ${subject} -> ${to}`);console.log(text);return {delivered:false,transport:'console'};
}
module.exports={sendMail,configured,transportName};
