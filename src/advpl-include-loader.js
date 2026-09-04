/*
 * CARREGADOR DE HEADERS ADVPL DISTRIBUÍDOS
 * ---------------------------------------
 * Busca sob demanda apenas os .CH referenciados pelo fonte e por seus filhos.
 * A lista permitida vem de catalog.json; um nome arbitrário nunca vira URL.
 * O pré-processador continua síncrono: esta camada prepara o manifesto antes
 * que o pipeline comece, mantendo I/O fora da transformação textual.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AdvPLIncludeLoader = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const VERSION = "0.1";
  const DEFAULT_BASE = "vendor/protheus-includes";
  const includePattern = /^\s*#\s*include\s*(?:"([^"]+)"|<([^>]+)>)/gim;
  const catalogCache = new Map(), sourceCache = new Map();

  function referencedBy(source) {
    const names = [];
    for (const match of String(source ?? "").matchAll(includePattern)) names.push((match[1] || match[2]).replace(/\\/g, "/").toUpperCase());
    return names;
  }

  async function fetchCatalog(baseUrl, fetchImpl) {
    if (!catalogCache.has(baseUrl)) catalogCache.set(baseUrl, fetchImpl(`${baseUrl}/catalog.json`).then(response => {
      if (!response.ok) throw new Error(`Catálogo de includes indisponível (${response.status}).`);
      return response.json();
    }));
    return catalogCache.get(baseUrl);
  }

  async function load(source, options = {}) {
    const references = referencedBy(source);
    if (!references.length) return { includes: {}, loaded: [], missing: [], catalog: null };
    const fetchImpl = options.fetch || globalThis.fetch;
    if (typeof fetchImpl !== "function") return { includes: {}, loaded: [], missing: references, catalog: null };
    const baseUrl = String(options.baseUrl || DEFAULT_BASE).replace(/\/$/, "");
    const catalog = await fetchCatalog(baseUrl, fetchImpl), includes = {}, loaded = [], missing = [], pending = [...references];
    const seen = new Set();
    while (pending.length) {
      const requested = pending.shift();
      if (seen.has(requested)) continue;
      seen.add(requested);
      const filename = catalog.files?.[requested];
      if (!filename) { missing.push(requested); continue; }
      const key = `${baseUrl}/${filename}`;
      if (!sourceCache.has(key)) sourceCache.set(key, fetchImpl(`${baseUrl}/include/${encodeURIComponent(filename)}`).then(response => {
        if (!response.ok) throw new Error(`Include ${filename} indisponível (${response.status}).`);
        return response.text();
      }));
      const content = await sourceCache.get(key);
      includes[filename] = content;
      loaded.push(filename);
      pending.push(...referencedBy(content));
    }
    return { includes, loaded, missing, catalog: { version: catalog.version, upstream: catalog.upstream, commit: catalog.commit } };
  }

  function clearCache() { catalogCache.clear(); sourceCache.clear(); }
  return Object.freeze({ VERSION, DEFAULT_BASE, referencedBy, load, clearCache });
});
