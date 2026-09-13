const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const core = require("../src/advpl-core.js");
const pipeline = require("../src/execution-pipeline.js");
const adapter = require("../src/tds-parser-adapter.js");
const { parser } = require("@totvs/tds-parsers");
const source = fs.readFileSync(require("node:path").join(__dirname, "fixtures/ppo-input/message.ppo"), "utf8");

// Fixture sintética: comprova transporte e execução local, não expansão TOTVS.
test("PPO atravessa TDS, execução e modelo preservando equivalência e ordem", async () => {
  const run = pipeline.create({ preprocess: core.preprocess, parse: core.parse,
    analyze: text => adapter.analyze(text, { mode: "tds", parser }) });
  const result = await run.run(source, { inputMode: "ppo", preprocessor: { filename: "demo.ppo", defines: { nTotal: "999" } } });
  assert.equal(result.executed, true);
  assert.equal(result.analysis.fallbackUsed, false);
  assert.equal(result.program.preprocessor.source, source);
  assert.equal(result.program.preprocessor.artifact.kind, "provided-ppo");
  assert.equal(result.program.preprocessor.artifact.compatibility, "unverified");
  assert.deepEqual(result.program.events, core.parse(source).events);
  assert.deepEqual(result.program.events.map(event => event.type), ["console", "message", "console"]);
  assert.equal(result.program.message.text, "Total: 5");
  assert.equal(core.validateModel(result.program).valid, true);
});

test("PPO preserva bytes, proveniência declarada e posições sem executar preprocessamento", () => {
  const provenance = { toolchain: "fixture sintética", reference: "teste local" };
  const text = '// comentário\r\nConOut("#define X // literal")\r\n';
  const result = core.preprocess(text, { inputMode: "ppo", filename: "sample.ppo", defines: { X: "outro" }, provenance });
  provenance.toolchain = "mudou";
  assert.equal(result.source, text);
  assert.equal(result.artifact.provenance.toolchain, "fixture sintética");
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(result.applied, []);
  assert.equal(result.map[1].originalFile, "sample.ppo");
  assert.equal(result.map[1].originalLine, 2);
});

test("diretivas PPO bloqueiam análise e efeitos, incluindo execução síncrona", async () => {
  for (const directive of ['#include "TOTVS.CH"', '#define X 1', '#line 20 "origem.prw"']) {
    const run = pipeline.create({ preprocess: core.preprocess,
      analyze: () => assert.fail("não deve analisar"), parse: () => assert.fail("não deve executar") });
    const text = "// exemplo\n  " + directive + '\nMsgInfo("não executar")';
    const result = await run.run(text, { inputMode: "ppo", preprocessor: { filename: "invalid.ppo" } });
    assert.equal(result.executed, false);
    assert.equal(result.analysis.diagnostics[0].code, "PPO0001");
    assert.equal(result.analysis.diagnostics[0].line, 2);
    assert.equal(result.analysis.diagnostics[0].column, 3);
    assert.equal(result.analysis.diagnostics[0].file, "invalid.ppo");
    assert.throws(() => core.parse(text, { inputMode: "ppo" }), error => error.diagnostics[0].code === "PPO0001");
  }
});

test("diretivas comentadas não bloqueiam, diretivas depois de comentário bloqueiam", () => {
  assert.deepEqual(core.preprocess('/*\n#define X 1\n*/\nConOut("ok")', { inputMode: "ppo" }).diagnostics, []);
  assert.equal(core.preprocess('/* comentário */ #define X 1', { inputMode: "ppo" }).diagnostics[0].line, 1);
});

test("erros TDS mantêm linha do PPO e impedem execução", async () => {
  const run = pipeline.create({ preprocess: core.preprocess, parse: () => assert.fail("efeito"),
    analyze: text => adapter.analyze(text, { mode: "tds", parser }) });
  const result = await run.run('User Function T()\nLocal c := "sem fim\nReturn', { inputMode: "ppo", preprocessor: { filename: "erro.ppo" } });
  assert.equal(result.executed, false);
  assert.equal(result.analysis.diagnostics[0].file, "erro.ppo");
  assert.equal(result.analysis.diagnostics[0].line, result.analysis.diagnostics[0].generatedLine);
});

test("modo desconhecido falha explicitamente e PRW continua expandindo", async () => {
  assert.throws(() => core.parse(source, { inputMode: "oficial" }), /inputMode/);
  const run = pipeline.create({ preprocess: core.preprocess, analyze: () => assert.fail(), parse: core.parse });
  await assert.rejects(run.run(source, { inputMode: "oficial" }), /inputMode/);
  const result = core.parse('#define N 42\nConOut(N)');
  assert.equal(result.events[0].text, "42");
  assert.notEqual(result.preprocessor.artifact.kind, "provided-ppo");
});
