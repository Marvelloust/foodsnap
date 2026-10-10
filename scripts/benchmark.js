#!/usr/bin/env node
const path=require('path');if(!process.env.FOODSNAP_DB)process.env.FOODSNAP_DB=path.join(__dirname,'..','data','foodsnap-lab.sqlite');const {db,dbPath}=require('../lib/db');const {queryIndex,rebuildSearchIndex}=require('../lib/search');
const tests=[
 ['Feed',()=>db.prepare(`SELECT p.id,p.caption,p.created_at,u.username,(SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) likes,(SELECT COUNT(*) FROM post_comments c WHERE c.post_id=p.id AND c.deleted_at IS NULL) comments FROM posts p JOIN users u ON u.id=p.user_id WHERE p.visibility='public' ORDER BY p.created_at DESC LIMIT 50`).all()],
 ['Messages',()=>{const c=db.prepare('SELECT conversation_id id FROM conversation_members ORDER BY conversation_id DESC LIMIT 1').get();return c?db.prepare('SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at DESC LIMIT 100').all(c.id):[]}],
 ['Notifications',()=>{const u=db.prepare('SELECT id FROM users ORDER BY id DESC LIMIT 1').get();return u?db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(u.id):[]}],
 ['Recipes',()=>db.prepare('SELECT * FROM recipes ORDER BY title LIMIT 100').all()],
 ['Analytics',()=>{const u=db.prepare('SELECT id FROM users ORDER BY id LIMIT 1').get();return u?db.prepare(`SELECT substr(created_at,1,10) d,COUNT(*) n FROM scans WHERE user_id=? GROUP BY d ORDER BY d DESC LIMIT 30`).all(u.id):[]}],
 ['FTS rice',()=>queryIndex('rice',50)],['FTS chicken',()=>queryIndex('chicken',50)],['FTS tomato',()=>queryIndex('tomato',50)]
];
rebuildSearchIndex();console.log(`FoodSnap benchmark: ${dbPath}`);let failed=0;for(const [name,fn] of tests){const runs=[];for(let i=0;i<7;i++){const t=performance.now();fn();runs.push(performance.now()-t)}runs.shift();runs.sort((a,b)=>a-b);const p50=runs[Math.floor(runs.length*.5)],p95=runs[Math.floor(runs.length*.95)]||runs.at(-1);const warn=p95>500;failed+=warn?1:0;console.log(`${name.padEnd(20)} p50=${p50.toFixed(1).padStart(7)}ms p95=${p95.toFixed(1).padStart(7)}ms ${warn?'SLOW':'OK'}`)}process.exitCode=failed?2:0;
