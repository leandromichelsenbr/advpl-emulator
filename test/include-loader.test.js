const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const loader = require("../src/advpl-include-loader.js");
const preprocessor = require("../src/advpl-preprocessor.js");

function fakeFetch(resources, calls) {
  return async url => {
    calls.push(url);
    const value = resources[url];
    return {
      ok: value !== undefined,
      status: value === undefined ? 404 : 200,
      json: async () => JSON.parse(value),
      text: async () => value
    };
  };
}

test("carrega somente a árvore de includes referenciada", async () => {
  loader.clearCache();
  const calls = [], base = "/catalogo";
  const resources = {
    [`${base}/catalog.json`]: JSON.stringify({ version: "teste", upstream: "origem", commit: "abc", files: { "TOTVS.CH": "totvs.ch", "PROTHEUS.CH": "protheus.ch", "NAOUSA.CH": "naousa.ch" } }),
    [`${base}/include/totvs.ch`]: '#include "PROTHEUS.CH"',
    [`${base}/include/protheus.ch`]: "#define TITULO 'Teste'"
  };
  const result = await loader.load('#include "totvs.ch"', { baseUrl: base, fetch: fakeFetch(resources, calls) });
  assert.deepEqual(Object.keys(result.includes), ["totvs.ch", "protheus.ch"]);
  assert.deepEqual(result.loaded, ["totvs.ch", "protheus.ch"]);
  assert.deepEqual(result.missing, []);
  assert.equal(calls.some(url => url.includes("naousa.ch")), false);
  assert.deepEqual(result.catalog, { version: "teste", upstream: "origem", commit: "abc" });
});

test("informa headers ausentes sem tentar formar uma URL arbitrária", async () => {
  loader.clearCache();
  const calls = [], base = "/catalogo-ausente";
  const resources = { [`${base}/catalog.json`]: JSON.stringify({ files: {} }) };
  const result = await loader.load('#include "INEXISTENTE.CH"', { baseUrl: base, fetch: fakeFetch(resources, calls) });
  assert.deepEqual(result.missing, ["INEXISTENTE.CH"]);
  assert.deepEqual(calls, [`${base}/catalog.json`]);
});

test("o catálogo distribuído resolve TOTVS.CH e suas dependências sem erro", () => {
  const directory = path.resolve(__dirname, "../vendor/protheus-includes/include");
  const includes = Object.fromEntries(fs.readdirSync(directory).filter(name => /\.ch$/i.test(name)).map(name => [name, fs.readFileSync(path.join(directory, name), "latin1")]));
  const result = preprocessor.process('#include "TOTVS.CH"\nConOut(CLR_RED)', { filename: "catalog-test.prw", includes, maxIncludeDepth: 32 });
  assert.equal(result.diagnostics.some(item => item.severity === "error"), false);
  assert.match(result.source, /ConOut\(128\)/);
  assert.equal(result.map.some(item => item.originalFile.toLowerCase() === "protheus.ch"), true);
  assert.equal(result.applied.includes("command-recognition"), true);
  assert.equal(result.applied.includes("translation-recognition"), true);
  const parameterized = preprocessor.process('#include "STDWIN.CH"\nConOut(_DFSET("DD/MM/YYYY", "DD/MM/YY"))', { filename: "macro-test.prw", includes, maxIncludeDepth: 32 });
  assert.equal(parameterized.diagnostics.some(item => item.severity === "error"), false);
  assert.match(parameterized.source, /ConOut\(Set\( 4, if\(__SetCentury\(\), "DD\/MM\/YYYY", "DD\/MM\/YY"\) \)\)/);
  assert.equal(parameterized.applied.includes("parameter-macro-expansion"), true);
  const translated = preprocessor.process('#include "DWDEFS.CH"\nConOut(isNull(Foo(1, 2)))\nConOut(DWGetProp("code"))', { filename: "translation-test.prw", includes, maxIncludeDepth: 32 });
  assert.equal(translated.diagnostics.some(item => item.severity === "error"), false);
  assert.match(translated.source, /ConOut\(\(valType\(Foo\(1, 2\)\)=="U"\)\)/);
  assert.match(translated.source, /ConOut\(DWGetProp\("code", procname\(0\)\)\)/);
  assert.equal(translated.applied.includes("translation-expansion"), true);
});
