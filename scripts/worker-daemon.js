#!/usr/bin/env node
require('../lib/env').loadEnv();
process.env.FOODSNAP_WORKER_ONLY='1';
process.env.FOODSNAP_RUN_JOBS='1';
const runtime=require('../server');
runtime.startBackground();
console.log('FoodSnap worker running. Press Ctrl+C to stop.');
const keepAlive=setInterval(()=>{},60_000);
const stop=()=>{clearInterval(keepAlive);runtime.stopBackground();process.exit(0)};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
