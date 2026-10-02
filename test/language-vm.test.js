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

test("VM executa somente o ramo selecionado de If/Else", () => {
  const source = 'User Function Demo(n)\nIf n < 0\nMsgInfo("negativo", "Sinal")\nElse\nMsgInfo("positivo", "Sinal")\nEndIf\nReturn';
  const negative = execute(source, { args: [-3] });
  const positive = execute(source, { args: [3] });
  assert.deepEqual(negative.events, [{ type: "message", kind: "info", text: "negativo", title: "Sinal" }]);
  assert.deepEqual(positive.events, [{ type: "message", kind: "info", text: "positivo", title: "Sinal" }]);
  assert.deepEqual(negative.diagnostics, []);
  assert.deepEqual(positive.diagnostics, []);
});

test("VM executa expressão unária e Abs pelo runtime permitido", () => {
  const result = execute('User Function Demo()\nLocal n := -12\nConOut(cValToChar(Abs(n)))\nReturn');
  assert.deepEqual(result.console, ["12"]);
  assert.deepEqual(result.diagnostics, []);
});

test("VM rejeita destino de salto fora do bytecode", () => {
  const bytecode = { bytecodeVersion: "0.1", entry: "DEMO", constants: [], diagnostics: [], functions: { DEMO: { localCount: 0, parameterCount: 0, instructions: [{ op: "JUMP", arg: 99 }] } } };
  const result = vm.run(bytecode);
  assert.equal(result.diagnostics[0].code, "LC_VM_INVALID_JUMP");
});

test("VM executa função AdvPL em frame isolado e devolve seu valor", () => {
  const source = 'User Function Demo()\nLocal n := 10\nLocal result := Sum(n, 5)\nn += 1\nConOut(cValToChar(result))\nConOut(cValToChar(n))\nReturn result\nStatic Function Sum(a, b)\nLocal result := a + b\nReturn result';
  const result = execute(source);
  assert.equal(result.completed, true);
  assert.equal(result.value, 15);
  assert.deepEqual(result.console, ["15", "11"]);
  assert.deepEqual(result.locals, [11, 15]);
  assert.deepEqual(result.diagnostics, []);
});

test("VM limita profundidade de chamadas recursivas", () => {
  const source = 'User Function Demo()\nReturn Recurse(1)\nStatic Function Recurse(n)\nReturn Recurse(n + 1)';
  const result = execute(source, { maxCallDepth: 4 });
  assert.equal(result.completed, false);
  assert.equal(result.diagnostics[0].code, "LC_RUNTIME_CALL_DEPTH");
});

test("VM diagnostica referência de função inexistente no bytecode", () => {
  const bytecode = { bytecodeVersion: "0.1", entry: "DEMO", constants: [], diagnostics: [], functions: { DEMO: { localCount: 0, parameterCount: 0, instructions: [{ op: "CALL_FUNCTION", name: "MISSING", argc: 0 }] } } };
  const result = vm.run(bytecode);
  assert.equal(result.diagnostics[0].code, "LC_VM_UNKNOWN_FUNCTION");
});

test("VM executa For positivo e acumula números pares", () => {
  const source = 'User Function Demo()\nLocal nNumber\nLocal nSum := 0\nFor nNumber := 0 To 100 Step 2\nnSum += nNumber\nNext\nMsgInfo("Sum of even numbers: " + cValToChar(nSum), "Resultado")\nReturn nSum';
  const result = execute(source);
  assert.equal(result.value, 2550);
  assert.deepEqual(result.events, [{ type: "message", kind: "info", text: "Sum of even numbers: 2550", title: "Resultado" }]);
  assert.deepEqual(result.diagnostics, []);
});

test("VM executa For regressivo e passo padrão", () => {
  const descending = execute('User Function Demo()\nLocal n\nFor n := 3 To 1 Step -1\nConOut(cValToChar(n))\nNext\nReturn');
  const standard = execute('User Function Demo()\nLocal n\nFor n := 1 To 3\nConOut(cValToChar(n))\nNext n\nReturn');
  assert.deepEqual(descending.console, ["3", "2", "1"]);
  assert.deepEqual(standard.console, ["1", "2", "3"]);
  assert.deepEqual(descending.diagnostics, []);
  assert.deepEqual(standard.diagnostics, []);
});

test("VM limita For com Step zero sem travar", () => {
  const result = execute('User Function Demo()\nLocal n\nFor n := 1 To 2 Step 0\nConOut(cValToChar(n))\nNext\nReturn', { maxSteps: 40 });
  assert.equal(result.completed, false);
  assert.equal(result.diagnostics[0].code, "LC_RUNTIME_STEP_LIMIT");
  assert.equal(result.steps, 40);
});

test("VM mantém slots temporários separados em For aninhado", () => {
  const source = 'User Function Demo()\nLocal i\nLocal j\nLocal nCount := 0\nFor i := 1 To 2\nFor j := 1 To 3\nnCount += 1\nNext\nNext\nReturn nCount';
  const result = execute(source);
  assert.equal(result.value, 6);
  assert.deepEqual(result.diagnostics, []);
});


test("VM reavalia While e preserva ordem dos efeitos", () => {
  const result = execute("User Function Demo()\nLocal n := 0\nWhile n < 3\nConOut(cValToChar(n))\nn += 1\nEndDo\nMsgInfo(cValToChar(n), \"Fim\")\nReturn n");
  assert.equal(result.completed, true);
  assert.equal(result.value, 3);
  assert.deepEqual(result.console, ['0', '1', '2']);
  assert.deepEqual(result.events.at(-1), { type: 'message', kind: 'info', text: '3', title: 'Fim' });
  assert.deepEqual(result.diagnostics, []);
});

test("VM ignora corpo falso e permite While vazio", () => {
  const result = execute("User Function Demo()\nWhile 1 > 2\nUnknownCall()\nEndDo\nWhile 1 != 1\nEndDo\nReturn 7");
  assert.equal(result.completed, true);
  assert.equal(result.value, 7);
  assert.deepEqual(result.events, []);
  assert.deepEqual(result.diagnostics, []);
});

test("VM combina While, For e If com locais e temporários isolados", () => {
  const result = execute("User Function Demo()\nLocal i := 0\nLocal j\nLocal total := 0\nWhile i < 2\nFor j := 1 To 3\nLocal k := 0\nWhile k < j\nIf k == 0\ntotal += 1\nElse\ntotal += 2\nEndIf\nk += 1\nEndDo\nNext\ni += 1\nEndDo\nReturn total");
  assert.equal(result.completed, true);
  assert.equal(result.value, 18);
  assert.deepEqual(result.diagnostics, []);
});

test("VM reavalia chamada na condição e retorna do frame dentro do While", () => {
  const result = execute("User Function Demo()\nLocal n := Count(0)\nConOut(cValToChar(n))\nReturn n\nStatic Function Count(n)\nWhile Probe(n) < 3\nn += 1\nIf n == 2\nReturn n\nEndIf\nEndDo\nReturn 99\nStatic Function Probe(n)\nConOut(cValToChar(n))\nReturn n");
  assert.equal(result.completed, true);
  assert.equal(result.value, 2);
  assert.deepEqual(result.console, ['0', '1', '2']);
  assert.deepEqual(result.diagnostics, []);
});

test("VM limita While infinito vazio com diagnóstico posicionado", () => {
  const bytecode = compiler.compile(language.bind(language.parse("User Function Demo()\nWhile 1 == 1\nEndDo\nReturn", { filename: 'infinite.ppo' })));
  const result = vm.run(bytecode, { maxSteps: 21 });
  assert.equal(result.completed, false);
  assert.equal(result.steps, 21);
  assert.equal(result.diagnostics[0].code, 'LC_RUNTIME_STEP_LIMIT');
  assert.equal(result.diagnostics[0].file, 'infinite.ppo');
  assert.equal(result.diagnostics[0].line, 2);
});
