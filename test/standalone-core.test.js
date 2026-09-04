const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("carrega advpl-core sozinho em integrações legadas do navegador", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src", "advpl-core.js"), "utf8");
  const context = { console };

  vm.runInNewContext(source, context, { filename: "advpl-core.js" });

  assert.equal(typeof context.AdvPLCore?.parse, "function");
  assert.equal(context.AdvPLCore.PACKAGE_VERSION, "0.19.0");
  const program = context.AdvPLCore.parse('#include "TOTVS.CH"\nUser Function T()\nMsgInfo("OK", "Teste")\nReturn');
  assert.equal(program.message.text, "OK");
  assert.equal(program.modelVersion, "0.1");
  assert.equal(program.preprocessor.version, "legacy");
  assert.equal(program.preprocessor.artifact.kind, "original-source");
  assert.equal(program.preprocessor.artifact.compatibility, "none");
  const original = '#define N 42\nConOut(N)';
  assert.equal(context.AdvPLCore.preprocess(original).source, original);
  assert.equal(context.AdvPLCore.preprocess(original).artifact.label, "Fonte original — pré-processador não carregado");
});
