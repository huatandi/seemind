const MODEL_CACHE='seemind-model-assets-v1';

self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  event.respondWith((async()=>{
    const cache=await caches.open(MODEL_CACHE);
    const cached=await cache.match(req);
    if(cached)return cached;
    return fetch(req);
  })());
});
