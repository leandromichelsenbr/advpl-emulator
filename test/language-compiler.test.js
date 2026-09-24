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

test("compila If/Else para saltos absolutos verificáveis", () => {
  const bytecode = compile('User Function Demo(n)\nIf n >= 10\nConOut("maior")\nElse\nConOut("menor")\nEndIf\nReturn');
  assert.deepEqual(bytecode.diagnostics, []);
  const instructions = bytecode.functions.DEMO.instructions;
  assert.equal(instructions.some(item => item.op === "GE"), true);
  assert.equal(instructions.some(item => item.op === "JUMP_IF_FALSE"), true);
  assert.equal(instructions.some(item => item.op === "JUMP"), true);
  for (const jump of instructions.filter(item => item.op.startsWith("JUMP"))) {
    assert.equal(Number.isInteger(jump.arg), true);
    assert.equal(jump.arg >= 0 && jump.arg <= instructions.length, true);
  }
});

test("compila atribuições e distingue função AdvPL de serviço do runtime", () => {
  const bytecode = compile('User Function Demo()\nLocal n := Sum(2, 3)\nn += 4\nConOut(cValToChar(n))\nReturn\nStatic Function Sum(a, b)\nReturn a + b');
  assert.deepEqual(bytecode.diagnostics, []);
  const instructions = bytecode.functions.DEMO.instructions;
  assert.equal(instructions.some(item => item.op === "CALL_FUNCTION" && item.name === "SUM"), true);
  assert.equal(instructions.some(item => item.op === "CALL_RUNTIME" && item.name === "CONOUT"), true);
  assert.equal(instructions.filter(item => item.op === "STORE_LOCAL").length, 2);
  assert.equal(instructions.some(item => item.op === "ADD"), true);
});

test("compila For com limite e passo avaliados em slots temporários", () => {
  const bytecode = compile('User Function Demo()\nLocal n\nFor n := 0 To 4 Step 2\nConOut(cValToChar(n))\nNext\nReturn');
  assert.deepEqual(bytecode.diagnostics, []);
  const fn = bytecode.functions.DEMO, ops = fn.instructions.map(item => item.op);
  assert.equal(fn.localCount, 3);
  assert.equal(fn.slots.N, 0);
  assert.equal(ops.filter(op => op === "STORE_LOCAL").length >= 4, true);
  assert.equal(ops.includes("JUMP_IF_FALSE"), true);
  assert.equal(ops.includes("LE"), true);
  assert.equal(ops.includes("GE"), true);
  assert.equal(fn.instructions.some(item => item.op === "JUMP" && Number.isInteger(item.arg)), true);
});
