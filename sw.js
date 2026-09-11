const CACHE='fake-cable-shell-v66';
const SHELL=['/','/styles.css','/app.js','/captions.js','/schedule.js','/playback.js','/player.js','/tuning-static.js','/remote.js','/lineup-share.js','/mixes.js','/channel-input.js','/storage.js','/guide.js','/vendor/qrcode.min.js','/vendor/peerjs.min.js','/manifest.webmanifest','/icons/fake-cable-192.png','/icons/fake-cable-512.png'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;

  if(request.mode==='navigate'){
    event.respondWith(
      fetch(request).then(response=>{
        if(response.ok)caches.open(CACHE).then(cache=>cache.put('/',response.clone()));
        return response;
      }).catch(()=>caches.match('/'))
    );
    return;
  }

  if(SHELL.includes(url.pathname)){
    event.respondWith(
      fetch(request).then(response=>{
        if(response.ok)caches.open(CACHE).then(cache=>cache.put(request,response.clone()));
        return response;
      }).catch(()=>caches.match(request).then(cached=>cached||caches.match(url.pathname)))
    );
  }
});
