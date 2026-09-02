const CACHE_NAME = "rag-chantier-shell-v1";
const SHELL_FILES = ["./", "./index.html", "./css/style.css", "./js/app.js", "./js/config.js"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
});

self.addEventListener("fetch", (event) => {
  // Ne met en cache que la coquille de l'app — jamais les appels au webhook,
  // pour ne jamais servir une réponse de recherche périmée.
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
