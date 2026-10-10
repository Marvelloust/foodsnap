function nodeVersion(){const [major,minor]=process.versions.node.split('.').map(Number);return {major,minor}}
function createDatabase(file){
  const {major,minor}=nodeVersion();
  if(major>22||(major===22&&minor>=5)){
    const {DatabaseSync}=require('node:sqlite');
    return new DatabaseSync(file);
  }
  try{
    const BetterSqlite3=require('better-sqlite3');
    return new BetterSqlite3(file);
  }catch(e){
    const err=new Error(`FoodSnap on Node ${process.version} needs the optional better-sqlite3 package. Run npm install, or upgrade to Node.js 22.5+.`);
    err.cause=e;throw err;
  }
}
module.exports={createDatabase,nodeVersion};
