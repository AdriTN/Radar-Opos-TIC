// Service worker: red primero (datos siempre frescos) y caché como respaldo sin conexión.
const V = "radar-v8";
const SHELL = ["./", "index.html", "app.css", "app.js", "manifest.webmanifest", "icon.svg", "scripts/lib/festivos.mjs", "scripts/lib/util.mjs", "scripts/lib/ics.mjs",
  "data/seed.json", "data/auto.json", "data/watch.json", "data/retribuciones.json", "data/historico.json", "data/historico-seed.json", "data/salud.json", "data/seed-datos.json", "data/mi-situacion.json", "data/festivos-oficiales.json", "data/festivos-extra.json"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(V).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null)))).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then((res) => { if (res.ok) { const c = res.clone(); caches.open(V).then((x) => x.put(r, c)); } return res; }).catch(() => caches.match(r).then((m) => m || caches.match("index.html"))));
});
