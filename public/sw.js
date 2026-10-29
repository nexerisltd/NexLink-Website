// App shell cache (offline start) + push notifications. Never caches /api or other origins.
const V='nl-v2',SHELL=['/','/logo.png','/icon-192.png','/favicon.png','/manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL).catch(()=>{})));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/'))return;
  if(r.mode==='navigate'){
    e.respondWith(fetch(r).then(res=>{if(u.pathname==='/'){const cp=res.clone();caches.open(V).then(c=>c.put('/',cp))}return res}).catch(()=>caches.match('/')));
    return;
  }
  if(u.pathname.startsWith('/_next/static/')||/\.(png|webp|svg|ico|woff2?)$/.test(u.pathname)){
    e.respondWith(caches.match(r).then(h=>h||fetch(r).then(res=>{const cp=res.clone();caches.open(V).then(c=>c.put(r,cp));return res})));
  }
});
self.addEventListener('push',e=>{
  const d=(()=>{try{return e.data.json()}catch{return{}}})();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
    if(cs.some(c=>c.visibilityState==='visible'))return;
    return self.registration.showNotification(d.title||'NexLink.Chat',{body:d.body||'New encrypted message',icon:'/icon-192.png',badge:'/favicon.png',tag:d.tag});
  }));
});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>cs[0]?cs[0].focus():self.clients.openWindow('/')))});
