const test = require("node:test");
const assert = require("node:assert/strict");
const language = require("../src/advpl-language-core.js");
const compiler = require("../src/advpl-language-compiler.js");

function compile(source) { return compiler.compile(language.bind(language.parse(source, { filename: "compiler.ppo" }))); }

test("compila a fatia inicial para bytecode stack-based 0.1 com posições", () => {
  const bytecode = compile('User Function Demo()\nLocal n := 2 + 3\nConOut(cValToChar(n))\nReturn');
  assert.equal(bytecode.bytecodeVersion, "0.1");
  assert.equal(bytecode.entry, "DEMO");
  assert.deepEqual(bytecode.diagnostics, []);
  assert.deepEqual(bytecode.functions.DEMO.instructions.map(item => item.op), [
    "PUSH_CONST", "PUSH_CONST", "ADD", "STORE_LOCAL", "LOAD_LOCAL",
    "CALL_RUNTIME", "CALL_RUNTIME", "POP", "PUSH_CONST", "RETURN"
  ]);
  assert.equal(bytecode.functions.DEMO.instructions.every(item => item.loc.start.file === "compiler.ppo"), true);
});

test("atribui slots estáveis primeiro a parâmetros e depois a locais", () => {
  const bytecode = compile('Static Function Demo(a, b)\nLocal result := a + b\nReturn result');
  assert.deepEqual(bytecode.functions.DEMO.slots, { A: 0, B: 1, RESULT: 2 });
  assert.equal(bytecode.functions.DEMO.parameterCount, 2);
  assert.equal(bytecode.functions.DEMO.localCount, 3);
});

test("compiler diagnostica identificador não vinculado sem executar", () => {
  const bytecode = compile('User Function Demo()\nConOut(missing)\nReturn');
  assert.equal(bytecode.diagnostics.some(item => item.code === "LC0302"), true);
});
