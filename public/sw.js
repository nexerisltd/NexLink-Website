self.addEventListener('fetch',()=>{});
self.addEventListener('push',e=>{
  const d=(()=>{try{return e.data.json()}catch{return{}}})();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{
    if(cs.some(c=>c.visibilityState==='visible'))return; // app is open and visible: it shows the message itself
    return self.registration.showNotification(d.title||'NexLink.Chat',{body:d.body||'New encrypted message',icon:'/icon-192.png',badge:'/favicon.png',tag:d.tag});
  }));
});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>cs[0]?cs[0].focus():self.clients.openWindow('/')))});
