const test = require("node:test");
const assert = require("node:assert/strict");
const language = require("../src/advpl-language-core.js");
const compiler = require("../src/advpl-language-compiler.js");
const vm = require("../src/advpl-language-vm.js");

function execute(source, options) { return vm.run(compiler.compile(language.bind(language.parse(source))), options); }

test("VM executa aritmética, locais, concatenação e console", () => {
  const result = execute('User Function Demo()\nLocal n := 2 + 3 * 4\nConOut("Total: " + cValToChar(n))\nReturn');
  assert.equal(result.completed, true);
  assert.deepEqual(result.events, [{ type: "console", text: "Total: 14" }]);
  assert.deepEqual(result.console, ["Total: 14"]);
  assert.deepEqual(result.diagnostics, []);
});

test("VM bloqueia chamadas que não pertencem ao runtime permitido", () => {
  const result = execute('User Function Demo()\nDangerousFunction()\nReturn');
  assert.equal(result.completed, false);
  assert.equal(result.diagnostics.some(item => item.code === "LC_RUNTIME_UNKNOWN_CALL"), true);
});

test("VM diagnostica underflow, opcode desconhecido e entrada ausente", () => {
  const base = { bytecodeVersion: "0.1", entry: "DEMO", constants: [], diagnostics: [], functions: { DEMO: { localCount: 0, parameterCount: 0, instructions: [{ op: "POP" }] } } };
  assert.equal(vm.run(base).diagnostics[0].code, "LC_VM_STACK_UNDERFLOW");
  const unknown = structuredClone(base); unknown.functions.DEMO.instructions = [{ op: "INVENTED" }];
  assert.equal(vm.run(unknown).diagnostics[0].code, "LC_VM_UNKNOWN_OPCODE");
  assert.equal(vm.run({ ...base, entry: "MISSING" }).diagnostics[0].code, "LC_VM_ENTRY");
});

test("VM aplica limite de passos antes de executar além do permitido", () => {
  const bytecode = { bytecodeVersion: "0.1", entry: "DEMO", constants: [1], diagnostics: [], functions: { DEMO: { localCount: 0, parameterCount: 0, instructions: Array.from({ length: 4 }, () => ({ op: "PUSH_CONST", arg: 0 })) } } };
  const result = vm.run(bytecode, { maxSteps: 2 });
  assert.equal(result.diagnostics[0].code, "LC_RUNTIME_STEP_LIMIT");
  assert.equal(result.steps, 2);
});
