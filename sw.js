// Service worker: datos siempre frescos si hay red (network-first); cae a caché sin conexión.
const V = "radar-v1";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon.svg", "data/seed.json", "data/auto.json", "data/watch.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(V).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(
    fetch(r).then((res) => {
      const copia = res.clone();
      caches.open(V).then((c) => c.put(r, copia));
      return res;
    }).catch(() => caches.match(r).then((m) => m || caches.match("index.html")))
  );
});
