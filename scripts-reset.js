const fs=require('fs');const path=require('path');
for(const f of ['foodsnap.sqlite','foodsnap.sqlite-shm','foodsnap.sqlite-wal']){try{fs.rmSync(path.join(__dirname,'data',f),{force:true})}catch{}}
for(const f of fs.readdirSync(path.join(__dirname,'uploads'))){if(f!=='.gitkeep')fs.rmSync(path.join(__dirname,'uploads',f),{force:true,recursive:true})}
console.log('FoodSnap data reset. Start the app to recreate the knowledge database.');
