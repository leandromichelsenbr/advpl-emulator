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
  assert.equal(context.AdvPLCore.PACKAGE_VERSION, "0.26.0");
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

test("carrega o Language Core completo na ordem usada pelo navegador", () => {
  const context = { console };
  const files = [
    "advpl-language-core.js",
    "advpl-core-runtime.js",
    "advpl-language-compiler.js",
    "advpl-language-vm.js"
  ];
  for (const file of files) {
    const source = fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8");
    vm.runInNewContext(source, context, { filename: file });
  }

  const source = 'User Function Demo()\nLocal n := Sum(1, 2)\nLocal i\nFor i := 1 To 3\nn += i\nNext\nConOut(cValToChar(n))\nReturn\nStatic Function Sum(a, b)\nReturn a + b';
  const ast = context.AdvPLLanguageCore.parse(source, { filename: "browser.ppo" });
  const bound = context.AdvPLLanguageCore.bind(ast);
  const bytecode = context.AdvPLLanguageCompiler.compile(bound);
  const result = context.AdvPLLanguageVM.run(bytecode);

  assert.equal(context.AdvPLLanguageCompiler.BYTECODE_VERSION, "0.1");
  assert.equal(context.AdvPLLanguageVM.VM_VERSION, "0.1");
  assert.equal(result.completed, true);
  assert.deepEqual(Array.from(result.console), ["9"]);
  assert.equal(result.diagnostics.length, 0);
});
