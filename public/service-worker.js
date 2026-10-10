const CACHE='foodsnap-shell-1.0.0';
const SHELL=['/','/styles.css?v=1.0.0','/app.js?v=1.0.0','/favicon.svg','/manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==location.origin||url.pathname.startsWith('/api/'))return;
  event.respondWith(fetch(req).then(r=>{const copy=r.clone();if(r.ok)caches.open(CACHE).then(c=>c.put(req,copy));return r}).catch(()=>caches.match(req).then(r=>r||caches.match('/'))));
});
self.addEventListener('push',event=>{
  let data={title:'FoodSnap',body:'You have a new FoodSnap update.',url:'/app'};
  try{data={...data,...event.data.json()}}catch{}
  event.waitUntil(self.registration.showNotification(data.title||'FoodSnap',{body:data.body||'',icon:'/favicon.svg',badge:'/favicon.svg',data:{url:data.url||'/app'},tag:data.tag||'foodsnap'}));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=event.notification.data?.url||'/app';
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{for(const client of clients){if('focus' in client){client.navigate(url);return client.focus()}}return self.clients.openWindow(url)}));
});
