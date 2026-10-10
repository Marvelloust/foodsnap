const fs=require('fs');
const path=require('path');
const {db,dbPath,now}=require('../lib/db');
const root=path.join(__dirname,'..');
const backupDir=path.join(root,'backups');
fs.mkdirSync(backupDir,{recursive:true});

function pruneBackups(keepCount=7){
 const keep=Math.max(1,Math.min(100,Number(keepCount||7)));
 const files=fs.readdirSync(backupDir).filter(x=>/^foodsnap-.*\.sqlite$/.test(x)).map(name=>({name,fp:path.join(backupDir,name),mtime:fs.statSync(path.join(backupDir,name)).mtimeMs})).sort((a,b)=>b.mtime-a.mtime);
 for(const f of files.slice(keep))try{fs.rmSync(f.fp,{force:true})}catch{}
 return files.slice(0,keep).map(x=>x.name);
}

function runBackup(kind='automatic',keepCount=7){
 const t=now(),runId=Number(db.prepare('INSERT INTO backup_runs(kind,status,created_at) VALUES(?,\'running\',?)').run(kind,t).lastInsertRowid);
 try{
  db.exec('PRAGMA wal_checkpoint(FULL)');
  const stamp=new Date().toISOString().replace(/[:.]/g,'-'),file=`foodsnap-${stamp}.sqlite`,fp=path.join(backupDir,file);
  fs.copyFileSync(dbPath,fp);
  const bytes=fs.statSync(fp).size,integrity=String(Object.values(db.prepare('PRAGMA integrity_check').get()||{})[0]||'unknown');
  if(integrity.toLowerCase()!=='ok'){fs.rmSync(fp,{force:true});throw new Error(`Backup integrity check failed: ${integrity}`)}
  db.prepare("UPDATE backup_runs SET status='complete',file_path=?,bytes=?,integrity_status=?,completed_at=? WHERE id=?").run(fp,bytes,integrity,now(),runId);
  pruneBackups(keepCount);
  return {id:runId,file,fp,bytes,integrity};
 }catch(e){db.prepare("UPDATE backup_runs SET status='failed',error=?,completed_at=? WHERE id=?").run(String(e.message||e).slice(0,500),now(),runId);throw e}
}

function policy(){return db.prepare('SELECT * FROM backup_policies WHERE id=1').get()||{enabled:0,frequency_hours:24,keep_count:7,last_run_at:null}}
function due(){const p=policy();if(!p.enabled)return false;if(!p.last_run_at)return true;return Date.now()-new Date(p.last_run_at).getTime()>=Math.max(1,Number(p.frequency_hours||24))*3600000}
function markRun(){db.prepare('UPDATE backup_policies SET last_run_at=?,updated_at=? WHERE id=1').run(now(),now())}
module.exports={runBackup,pruneBackups,policy,due,markRun,backupDir};
