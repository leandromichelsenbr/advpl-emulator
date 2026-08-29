const test = require("node:test");
const assert = require("node:assert/strict");
const pipelineModule = require("../src/execution-pipeline.js");

const validAnalysis = { parser: "tds-parsers@0.1.5", ast: {}, diagnostics: [], fallbackUsed: false };

test("executa o parser leve somente depois da análise sintática", async () => {
  const order = [];
  const pipeline = pipelineModule.create({
    analyze: async () => { order.push("analyze"); return validAnalysis; },
    parse: () => { order.push("parse"); return { diagnostics: [] }; }
  });
  const result = await pipeline.run("fonte");
  assert.equal(result.executed, true);
  assert.deepEqual(order, ["analyze", "parse"]);
});

test("erro sintático impede qualquer efeito do executor", async () => {
  let parsed = false;
  const analysis = { ...validAnalysis, ast: null, diagnostics: [{ severity: "error", origin: "tds-parser" }] };
  const pipeline = pipelineModule.create({ analyze: async () => analysis, parse: () => { parsed = true; return {}; } });
  const result = await pipeline.run("inválido");
  assert.equal(result.executed, false);
  assert.equal(result.program, null);
  assert.equal(parsed, false);
});

test("fallback automático ainda permite execução pelo parser leve", async () => {
  const analysis = { parser: "light", ast: null, diagnostics: [], fallbackUsed: true, fallbackReason: "worker ausente" };
  const pipeline = pipelineModule.create({ analyze: async () => analysis, parse: () => ({ diagnostics: [] }) });
  const result = await pipeline.run("fonte");
  assert.equal(result.executed, true);
  assert.equal(result.analysis.fallbackUsed, true);
});

test("falha obrigatória do modo TDS é propagada sem executar o fonte", async () => {
  let parsed = false;
  const pipeline = pipelineModule.create({
    analyze: async () => { throw new Error("worker indisponível"); },
    parse: () => { parsed = true; return {}; }
  });
  await assert.rejects(pipeline.run("fonte"), /worker indisponível/);
  assert.equal(parsed, false);
});

test("resultado antigo é descartado quando uma execução mais nova termina primeiro", async () => {
  let releaseFirst;
  const first = new Promise(resolve => { releaseFirst = resolve; });
  let calls = 0;
  const pipeline = pipelineModule.create({
    analyze: async () => (++calls === 1 ? first : validAnalysis),
    parse: source => ({ source, diagnostics: [] })
  });
  const oldRun = pipeline.run("antigo");
  const newRun = await pipeline.run("novo");
  releaseFirst(validAnalysis);
  const oldResult = await oldRun;
  assert.equal(newRun.executed, true);
  assert.equal(newRun.program.source, "novo");
  assert.equal(oldResult.stale, true);
  assert.equal(oldResult.executed, false);
});
