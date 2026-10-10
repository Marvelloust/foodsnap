#!/usr/bin/env node
const path=require('path');
if(!process.env.FOODSNAP_DB)process.env.FOODSNAP_DB=path.join(__dirname,'..','data','foodsnap.sqlite');
const backups=require('../services/backups');
const result=backups.runBackup('manual-cli',backups.policy().keep_count);
console.log(result.fp);
