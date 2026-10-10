require('./lib/env').loadEnv();
try{
  require('./lib/sqlite').createDatabase(':memory:').close?.();
}catch(e){
  console.error(`\n${e.message}\n`);process.exit(1);
}
require('./server');
