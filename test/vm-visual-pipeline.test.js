const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/advpl-core.js");
const model = require("../src/advpl-model.js");
const visual = require("../src/advpl-vm-visual.js");
const pipelineModule = require("../src/execution-pipeline.js");
const tds = require("../src/tds-parser-adapter.js");
const { parser } = require("@totvs/tds-parsers");
const valid = () => ({ parser: "light", diagnostics: [], fallbackUsed: false });
const demo = 'User Function Demo()\nLocal n := 10\nLocal b := {|x| n += x, MsgInfo(cValToChar(n), "Total"), n}\nConOut(cValToChar(Eval(b, 2)))\nReturn Eval(b, 3)';
function pipeline(overrides = {}) {
  return pipelineModule.create({ preprocess: core.preprocess, analyze: async () => valid(), parse: () => assert.fail("não deve executar o parser leve"), createVM: visual.create, ...overrides });
}

test("blocos atravessam o parser TDS real antes de abrir a primeira mensagem da VM", async () => {
  const run = pipeline({ analyze: source => tds.analyze(source, { mode: "tds", parser }) });
  const result = await run.run(demo, { engine: "vm", inputMode: "ppo" });
  assert.equal(result.executed, true);
  assert.equal(result.analysis.fallbackUsed, false);
  assert.equal(result.program.message.text, "12");
  assert.equal(result.execution.snapshot().state, "suspended");
});

test("pipeline VM transforma PRW em PPO e publica modelo neutro com sessão suspensa", async () => {
  const result = await pipeline().run('#define START 10\n' + demo.replace(':= 10', ':= START'), { engine: "vm" });
  assert.equal(result.executed, true);
  assert.equal(model.validate(result.program).valid, true);
  assert.equal(result.program.execution.state, "suspended");
  assert.equal(result.program.execution.engine, "vm");
  assert.equal(result.program.message.text, "12");
  assert.deepEqual(result.program.console, []);
  assert.equal(result.program.preprocessor.source.includes(":= 10"), true);
  const second = result.execution.resume(result.execution.snapshot().suspension.token);
  assert.equal(model.validate(second.program).valid, true);
  assert.deepEqual(second.program.console, ["12"]);
  assert.equal(second.program.messages.at(-1).text, "15");
  const done = result.execution.resume(second.suspension.token);
  assert.equal(done.program.execution.value, 15);
  assert.equal(done.program.execution.state, "completed");
});

test("entrada PPO da VM permanece sem transformação ou pré-processamento local", async () => {
  const source = 'User Function Demo()\nConOut("literal")\nReturn';
  const result = await pipeline().run(source, { engine: "vm", inputMode: "ppo", preprocessor: { defines: { literal: "outro" } } });
  assert.equal(result.program.preprocessor.source, source);
  assert.equal(result.program.preprocessor.artifact.kind, "provided-ppo");
  assert.deepEqual(result.program.console, ["literal"]);
});

test("erro sintático e erro do compiler impedem efeitos da VM e preservam posição de origem", async () => {
  const syntax = pipeline({ analyze: async () => ({ diagnostics: [{ code: "SYNTAX", severity: "error", line: 1 }] }), createVM: () => assert.fail("não deve criar sessão") });
  assert.equal((await syntax.run(demo, { engine: "vm" })).executed, false);
  const bad = await pipeline().run('User Function Bad()\nConOut("não executar")\nReturn missing', { engine: "vm", preprocessor: { filename: "bad.prw" } });
  assert.equal(bad.executed, false);
  assert.equal(bad.program, null);
  const error = bad.analysis.diagnostics.find(item => item.code === "LC0302");
  assert.equal(error.file, "bad.prw"); assert.equal(error.line, 3);
});

test("diagnóstico de runtime preserva saídas anteriores e recebe remapeamento", async () => {
  const result = await pipeline().run('User Function Demo()\nConOut("antes")\nUnknownCall()\nReturn', { engine: "vm", preprocessor: { filename: "runtime.prw" } });
  assert.equal(result.executed, true);
  assert.deepEqual(result.program.console, ["antes"]);
  assert.equal(result.program.execution.state, "failed");
  const error = result.program.diagnostics.find(item => item.code === "LC_RUNTIME_UNKNOWN_CALL");
  assert.equal(error.file, "runtime.prw"); assert.equal(error.line, 3);
});

test("nova execução e cancelamento invalidam a sessão visual anterior", async () => {
  const run = pipeline();
  const first = await run.run(demo, { engine: "vm" });
  const token = first.execution.snapshot().suspension.token;
  const second = await run.run('User Function Demo()\nReturn 9', { engine: "vm" });
  assert.equal(first.execution.snapshot().state, "cancelled");
  assert.equal(first.execution.resume(token).operationError.code, "LC_VM_INVALID_RESUME");
  assert.equal(second.program.execution.value, 9);
  const third = await run.run(demo, { engine: "vm" });
  run.cancel();
  assert.equal(third.execution.snapshot().state, "cancelled");
});

test("resultado TDS atrasado não cria sessão VM nem substitui execução mais recente", async () => {
  let release, calls = 0, created = 0;
  const run = pipeline({ analyze: () => ++calls === 1 ? new Promise(resolve => { release = resolve; }) : Promise.resolve(valid()), createVM: (...args) => { created += 1; return visual.create(...args); } });
  const old = run.run(demo, { engine: "vm" });
  const current = await run.run('User Function Demo()\nReturn 9', { engine: "vm" });
  release(valid());
  assert.equal((await old).stale, true);
  assert.equal(created, 1);
  assert.equal(current.program.execution.value, 9);
});

test("seleção de engine é explícita e indisponibilidade não recai silenciosamente no legado", async () => {
  await assert.rejects(pipeline().run(demo, { engine: "outro" }), /engine/);
  const missing = pipeline({ createVM: undefined });
  await assert.rejects(missing.run(demo, { engine: "vm" }), /indisponível/);
  let legacy = false;
  const run = pipeline({ parse: () => { legacy = true; return { diagnostics: [] }; } });
  assert.equal((await run.run("legado")).executed, true);
  assert.equal(legacy, true);
});
