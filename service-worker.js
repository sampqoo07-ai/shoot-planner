const CACHE_NAME = "reels-planner-cache-v7";
const ASSETS = [
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      // 用 cache:"reload" 繞過瀏覽器的 HTTP 快取，確保裝進來的是真正的最新版
      return Promise.all(ASSETS.map(function(url){
        return fetch(new Request(url, {cache: "reload"})).then(function(res){
          if(res && res.ok) return cache.put(url, res);
        }).catch(function(){});
      }));
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(key){ return key !== CACHE_NAME; })
            .map(function(key){ return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function(event){
  if(event.request.method !== "GET") return;

  var url = new URL(event.request.url);
  var isPage = event.request.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("index.html");

  if(isPage){
    // 網頁本身走「網路優先」：有網路一定拿最新版，沒網路才退回快取。
    // 之前是快取優先，所以改版後裝置會一直吃到舊程式碼。
    event.respondWith(
      fetch(event.request).then(function(networkResponse){
        if(networkResponse && networkResponse.ok){
          var copy = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
        }
        return networkResponse;
      }).catch(function(){
        return caches.match(event.request).then(function(cached){
          return cached || caches.match("./index.html");
        });
      })
    );
    return;
  }

  // 圖示等靜態檔案維持快取優先，順便在背景更新
  event.respondWith(
    caches.match(event.request).then(function(cached){
      var fetchPromise = fetch(event.request).then(function(networkResponse){
        if(networkResponse && networkResponse.ok){
          var copy = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
        }
        return networkResponse;
      }).catch(function(){ return cached; });
      return cached || fetchPromise;
    })
  );
});
