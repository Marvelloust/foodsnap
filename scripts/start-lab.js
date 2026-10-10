#!/usr/bin/env node
const path=require('path');
process.env.FOODSNAP_DB=process.env.FOODSNAP_LAB_DB||path.join(__dirname,'..','data','foodsnap-lab.sqlite');
console.log(`FoodSnap Data Lab: ${process.env.FOODSNAP_DB}`);
require('../run');
