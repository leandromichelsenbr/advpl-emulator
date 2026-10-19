const test = require("node:test");
const assert = require("node:assert/strict");
const language = require("../src/advpl-language-core.js");
const compiler = require("../src/advpl-language-compiler.js");
const vm = require("../src/advpl-language-vm.js");
const runtime = require("../src/advpl-core-runtime.js");

function compile(source) { return compiler.compile(language.bind(language.parse(source, { filename: "session.ppo" }))); }
function create(source, options = {}) { return vm.createExecution(compile(source), { suspendOn: ["MsgInfo"], ...options }); }
const demo = 'User Function Demo()\nConOut("antes")\nMsgInfo("pausa", "Teste")\nConOut("depois")\nReturn 7';

test("sessão nasce pronta sem efeitos e suspende após a mensagem sem antecipar o console", () => {
  const session = create(demo);
  assert.equal(session.snapshot().state, "ready");
  assert.deepEqual(session.snapshot().events, []);
  const paused = session.run();
  assert.equal(paused.state, "suspended");
  assert.equal(paused.suspended, true);
  assert.equal(paused.completed, false);
  assert.deepEqual(paused.console, ["antes"]);
  assert.deepEqual(paused.events, [{ type: "console", text: "antes" }, { type: "message", kind: "info", text: "pausa", title: "Teste" }]);
  assert.equal(paused.suspension.name, "MSGINFO");
  assert.deepEqual(paused.suspension.args, ["pausa", "Teste"]);
  assert.equal(paused.suspension.loc.start.file, "session.ppo");
  assert.equal(paused.suspension.loc.start.line, 3);
  assert.deepEqual(session.run(), paused);
});

test("resume completa sem repetir efeitos e preserva resultados da API síncrona", () => {
  const bytecode = compile(demo), expected = vm.run(bytecode);
  const session = vm.createExecution(bytecode, { suspendOn: ["MSGINFO"] });
  const paused = session.run(), result = session.resume(paused.suspension.token);
  assert.equal(result.state, "completed");
  assert.equal(result.completed, true);
  assert.equal(result.suspended, false);
  assert.equal(result.suspension, null);
  assert.equal(result.value, 7);
  assert.equal(result.steps, expected.steps);
  assert.deepEqual(result.events, expected.events);
  assert.deepEqual(result.console, expected.console);
  assert.deepEqual(session.run(), result);
});

test("run síncrono continua sem suspender e sessões sem seleção também completam", () => {
  const result = vm.run(compile(demo), { suspendOn: ["MSGINFO"] });
  assert.equal(result.completed, true);
  assert.deepEqual(result.console, ["antes", "depois"]);
  const session = create(demo, { suspendOn: [] });
  assert.equal(session.run().state, "completed");
});

test("retorno de serviço suspenso preserva a pilha intermediária e recebe valor do host", () => {
  let calls = 0;
  const service = runtime.create({ Ask: () => { calls += 1; return 99; } });
  const source = 'User Function Demo()\nLocal n := 10 + Ask("valor") * 2\nConOut(cValToChar(n))\nReturn n';
  const session = create(source, { runtime: service, suspendOn: ["ask"] });
  const paused = session.run();
  assert.equal(paused.state, "suspended");
  assert.equal(calls, 1);
  const result = session.resume(paused.suspension.token, 3);
  assert.equal(result.value, 16);
  assert.deepEqual(result.console, ["16"]);
  assert.equal(calls, 1);
  const defaults = create('User Function Demo()\nReturn Ask()', { runtime: service, suspendOn: ["ASK"] });
  const waiting = defaults.run();
  assert.equal(defaults.resume(waiting.suspension.token).value, 99);
  for (const value of [null, undefined]) {
    const nil = create('User Function Demo()\nReturn Ask()', { runtime: service, suspendOn: ["ASK"] });
    const waiting = nil.run();
    assert.equal(nil.resume(waiting.suspension.token, value).value, null);
  }
});

test("pausa em closure retornada preserva capturas, frames aninhados e células compartilhadas", () => {
  const source = 'User Function Demo()\nLocal b := Counter(10)\nConOut(cValToChar(Eval(b, 2)))\nReturn Eval(b, 3)\nStatic Function Counter(n)\nReturn {|x| n += x, MsgInfo(cValToChar(n), "Total"), n}';
  const session = create(source);
  const first = session.run();
  assert.deepEqual(first.console, []);
  assert.equal(first.events[0].text, "12");
  const second = session.resume(first.suspension.token);
  assert.equal(second.state, "suspended");
  assert.deepEqual(second.console, ["12"]);
  assert.equal(second.events.at(-1).text, "15");
  const result = session.resume(second.suspension.token);
  assert.equal(result.value, 15);
  assert.equal(result.state, "completed");
  const sync = vm.run(compile(source));
  assert.deepEqual(result.events, sync.events);
  assert.equal(result.steps, sync.steps);
});

test("tokens descartam respostas atrasadas, duplicadas, forjadas e de outras sessões", () => {
  const source = 'User Function Demo()\nMsgInfo("um")\nMsgInfo("dois")\nReturn 2';
  const session = create(source), first = session.run();
  for (const token of [undefined, {}, create(source).run().suspension.token]) {
    const invalid = session.resume(token);
    assert.equal(invalid.operationError.code, "LC_VM_INVALID_RESUME");
    assert.equal(session.snapshot().steps, first.steps);
    assert.equal(session.snapshot().suspension.token, first.suspension.token);
  }
  const second = session.resume(first.suspension.token);
  assert.notEqual(second.suspension.token, first.suspension.token);
  assert.equal(session.resume(first.suspension.token).operationError.code, "LC_VM_INVALID_RESUME");
  assert.equal(session.snapshot().suspension.token, second.suspension.token);
  const done = session.resume(second.suspension.token);
  assert.equal(done.value, 2);
  assert.equal(session.resume(second.suspension.token).operationError.code, "LC_VM_INVALID_RESUME");
  assert.equal(session.snapshot().state, "completed");
  assert.equal(session.snapshot().events.length, 2);
});

test("cancelamento antes de começar e durante pausa é terminal e não antecipa efeitos", () => {
  const ready = create(demo);
  assert.equal(ready.cancel().state, "cancelled");
  assert.deepEqual(ready.run().events, []);
  const session = create(demo), paused = session.run();
  const cancelled = session.cancel();
  assert.equal(cancelled.state, "cancelled");
  assert.equal(cancelled.suspension, null);
  assert.deepEqual(cancelled.console, ["antes"]);
  assert.equal(session.resume(paused.suspension.token).operationError.code, "LC_VM_INVALID_RESUME");
  assert.deepEqual(session.run(), cancelled);
  assert.deepEqual(session.cancel(), cancelled);
});

test("pausas não renovam o limite global de instruções em laço infinito", () => {
  const source = 'User Function Demo()\nWhile 1 == 1\nMsgInfo("passo")\nEndDo\nReturn';
  const session = create(source, { maxSteps: 45 });
  let result = session.run(), pauses = 0;
  while (result.suspended && pauses < 20) { pauses += 1; result = session.resume(result.suspension.token); }
  assert.equal(pauses > 1, true);
  assert.equal(result.state, "failed");
  assert.equal(result.steps, 45);
  assert.equal(result.diagnostics[0].code, "LC_RUNTIME_STEP_LIMIT");
  assert.equal(result.diagnostics[0].file, "session.ppo");
  assert.equal(result.diagnostics[0].line >= 2, true);
});

test("retomadas mantêm profundidade global de frames durante recursão de blocos", () => {
  const source = 'User Function Demo()\nLocal b\nb := {|| MsgInfo("frame"), Eval(b)}\nReturn Eval(b)';
  const session = create(source, { maxCallDepth: 4 });
  let result = session.run();
  for (let i = 0; i < 5 && result.suspended; i += 1) result = session.resume(result.suspension.token);
  assert.equal(result.state, "failed");
  assert.equal(result.diagnostics[0].code, "LC_RUNTIME_CALL_DEPTH");
});

test("fonte inválido e entrada ausente falham sem iniciar ou permitir retomada", () => {
  for (const bytecode of [compile('User Function Demo()\nMsgInfo("não mostrar")\nReturn missing'), { entry: "MISSING", functions: {} }]) {
    const session = vm.createExecution(bytecode, { suspendOn: ["MSGINFO"] });
    assert.equal(session.snapshot().state, "failed");
    assert.deepEqual(session.run().events, []);
    assert.equal(session.run().steps, 0);
    assert.equal(session.resume({}).operationError.code, "LC_VM_INVALID_RESUME");
  }
  const noReturn = vm.createExecution({ bytecodeVersion: "0.1", entry: "DEMO", constants: [], functions: { DEMO: { localCount: 0, parameterCount: 0, instructions: [] } } }).run();
  assert.equal(noReturn.state, "failed");
  assert.equal(noReturn.diagnostics[0].code, "LC_VM_MISSING_RETURN");
});

test("snapshots não permitem alterar console, eventos, locais ou token pendente da sessão", () => {
  const session = create('User Function Demo()\nLocal n := 10\nMsgInfo("pausa")\nReturn n');
  const paused = session.run(), token = paused.suspension.token;
  paused.events[0].text = "alterado";
  paused.events.push({ type: "console", text: "injetado" });
  paused.console.push("injetado"); paused.locals[0] = 99;
  paused.suspension.args[0] = "alterado"; paused.suspension.loc.start.line = 999;
  paused.suspension.token = {};
  assert.equal(session.snapshot().events[0].text, "pausa");
  assert.deepEqual(session.snapshot().console, []);
  assert.equal(session.snapshot().suspension.args[0], "pausa");
  assert.equal(session.snapshot().suspension.loc.start.line, 3);
  assert.equal(session.resume(token).value, 10);
});

test("sessões intercaladas mantêm tokens, eventos e capturas independentes", () => {
  const source = 'User Function Demo(n)\nLocal b := {|x| n += x, MsgInfo(cValToChar(n)), n}\nReturn Eval(b, 2)';
  const first = create(source, { args: [1] }), second = create(source, { args: [10] });
  const a = first.run(), b = second.run();
  assert.equal(a.events[0].text, "3"); assert.equal(b.events[0].text, "12");
  assert.equal(second.resume(a.suspension.token).operationError.code, "LC_VM_INVALID_RESUME");
  assert.equal(first.resume(a.suspension.token).value, 3);
  assert.equal(second.resume(b.suspension.token).value, 12);
});

test("host não reentra na mesma sessão e falhas do serviço encerram a execução", () => {
  let session, reentrant;
  const services = runtime.create({ Probe: () => { reentrant = session.run(); return 5; } });
  session = create('User Function Demo()\nReturn Probe()', { runtime: services, suspendOn: [] });
  assert.equal(session.run().value, 5);
  assert.equal(reentrant.operationError.code, "LC_VM_REENTRANT");
  const broken = create('User Function Demo()\nBroken()\nConOut("não executar")\nReturn', {
    runtime: runtime.create({ Broken: () => { throw new Error("host failure"); } }), suspendOn: ["BROKEN"]
  }).run();
  assert.equal(broken.state, "failed");
  assert.equal(broken.diagnostics[0].code, "LC_RUNTIME_SERVICE_ERROR");
  assert.deepEqual(broken.events, []);
});

test("cancelamento pelo host durante serviço interrompe a continuação", () => {
  let session;
  session = create('User Function Demo()\nStopNow()\nConOut("não executar")\nReturn', {
    runtime: runtime.create({ StopNow: () => { session.cancel(); return 1; } }), suspendOn: ["STOPNOW"]
  });
  const result = session.run();
  assert.equal(result.state, "cancelled");
  assert.equal(result.suspension, null);
  assert.deepEqual(result.events, []);
});
