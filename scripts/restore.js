#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const {DatabaseSync}=require('node:sqlite');
const source=process.argv[2];
if(!source){console.error('Usage: npm run db:restore -- <backup.sqlite> [--force]');process.exit(1)}
const src=path.resolve(source),target=path.resolve(process.env.FOODSNAP_DB||path.join(__dirname,'..','data','foodsnap.sqlite'));
if(!fs.existsSync(src))throw new Error(`Backup not found: ${src}`);
const probe=new DatabaseSync(src,{readOnly:true});const row=probe.prepare('PRAGMA integrity_check').get();probe.close();
if(String(Object.values(row)[0]).toLowerCase()!=='ok')throw new Error('Backup failed SQLite integrity_check.');
if(fs.existsSync(target)&&!process.argv.includes('--force')){console.error(`Refusing to overwrite ${target}. Re-run with --force.`);process.exit(2)}
fs.mkdirSync(path.dirname(target),{recursive:true});
for(const suffix of ['','-wal','-shm'])try{fs.rmSync(target+suffix,{force:true})}catch{}
fs.copyFileSync(src,target);
console.log(`Restored ${src} -> ${target}`);
