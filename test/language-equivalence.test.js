const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/advpl-core.js");
const language = require("../src/advpl-language-core.js");
const compiler = require("../src/advpl-language-compiler.js");
const vm = require("../src/advpl-language-vm.js");

test("nova VM produz o mesmo evento de console do executor leve na fatia inicial", () => {
  const source = 'User Function Demo()\nLocal nTotal := 2 + 3\nConOut("Total: " + cValToChar(nTotal))\nReturn';
  const legacy = core.parse(source);
  const bytecode = compiler.compile(language.bind(language.parse(source, { filename: "equivalence.ppo" })));
  const modern = vm.run(bytecode);
  assert.deepEqual(modern.diagnostics, []);
  assert.deepEqual(modern.events, legacy.events);
  assert.deepEqual(modern.console, legacy.console);
});

test("nova VM preserva a mensagem do ramo If selecionado pelo executor leve", () => {
  const source = 'User Function Demo()\nLocal nValue := -123.45\nIf nValue < 0\nMsgInfo("Valor absoluto: " + cValToChar(Abs(nValue)), "Resultado")\nElse\nMsgInfo("Valor positivo", "Resultado")\nEndIf\nReturn';
  const legacy = core.parse(source);
  const bytecode = compiler.compile(language.bind(language.parse(source, { filename: "branch-equivalence.ppo" })));
  const modern = vm.run(bytecode);
  assert.deepEqual(modern.diagnostics, []);
  assert.deepEqual(modern.events, legacy.events);
});

test("nova VM preserva função auxiliar, atribuição composta e mensagem", () => {
  const source = 'User Function Demo()\nLocal nTotal := Sum(2, 3)\nnTotal += 4\nMsgInfo(cValToChar(nTotal), "Resultado")\nReturn\nStatic Function Sum(a, b)\nReturn a + b';
  const legacy = core.parse(source);
  const bytecode = compiler.compile(language.bind(language.parse(source, { filename: "call-equivalence.ppo" })));
  const modern = vm.run(bytecode);
  assert.deepEqual(modern.diagnostics, []);
  assert.deepEqual(modern.events, legacy.events);
});
