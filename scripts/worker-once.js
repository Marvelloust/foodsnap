#!/usr/bin/env node
const jobs=require('../services/jobs');jobs.tick().then(()=>console.log(jobs.stats())).catch(e=>{console.error(e);process.exitCode=1});
