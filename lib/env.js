const fs=require('fs');const path=require('path');
function loadEnv(file=path.join(__dirname,'..','.env')){if(!fs.existsSync(file))return;for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){const s=line.trim();if(!s||s.startsWith('#'))continue;const i=s.indexOf('=');if(i<1)continue;const key=s.slice(0,i).trim(),value=s.slice(i+1).trim().replace(/^['"]|['"]$/g,'');if(process.env[key]===undefined)process.env[key]=value}}
module.exports={loadEnv};
