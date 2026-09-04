const test = require("node:test");
const assert = require("node:assert/strict");
const preprocessor = require("../src/advpl-preprocessor.js");
const core = require("../src/advpl-core.js");
const pipeline = require("../src/execution-pipeline.js");

test("identifica o PPO didático sem alterar o contrato textual e isola os metadados", () => {
  const source = '#define VALOR 42\r\nConOut(VALOR)';
  const result = core.preprocess(source);
  assert.deepEqual(result.artifact, {
    kind: "didactic-ppo",
    label: "PPO didático — subconjunto do emulador",
    compatibility: "partial"
  });
  assert.equal(result.version, "0.1");
  assert.equal(result.source, '\r\nConOut(42)');
  assert.equal(result.definitions.VALOR, "42");
  assert.equal(result.map[1].originalLine, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(result)).artifact, result.artifact);
  result.artifact.kind = "alterado";
  assert.equal(core.preprocess("").artifact.kind, "didactic-ppo");
});

test("declara capacidades estáveis do pré-processador", () => {
  const result = preprocessor.process("");
  assert.deepEqual(result.capabilities, {
    objectMacros: "supported", conditionalCompilation: "supported", undef: "supported",
    sourceMap: "line", includes: "recognized", parameterMacros: "unsupported",
    translations: "unsupported", commands: "unsupported", embeddedSql: "unsupported"
  });
  result.capabilities.objectMacros = "alterado";
  assert.equal(preprocessor.process("").capabilities.objectMacros, "supported");
});

test("informa somente as transformações aplicadas em cada PPO", () => {
  const transformed = preprocessor.process('#define FLAG 1\n#ifdef FLAG\nConOut(FLAG)\n#endif\n#include "TOTVS.CH"\n#undef FLAG');
  assert.deepEqual(transformed.applied, [
    "object-macro-definition", "conditional-compilation", "object-macro-expansion",
    "include-recognition", "macro-undefinition"
  ]);
  assert.deepEqual(preprocessor.process('ConOut("sem alteração")').applied, []);
});

test("preserva o rótulo parcial em includes ignorados e erros de diretiva", () => {
  const included = preprocessor.process('#include "TOTVS.CH"\nConOut("OK")');
  const invalid = preprocessor.process('#command TEST => ConOut("TEST")');
  for (const result of [included, invalid]) {
    assert.equal(result.artifact.kind, "didactic-ppo");
    assert.equal(result.artifact.compatibility, "partial");
  }
  assert.equal(included.diagnostics[0].code, "PP0006");
  assert.equal(invalid.diagnostics[0].severity, "error");
});

test("expõe a identificação no modelo e na análise, inclusive quando a execução bloqueia", async () => {
  const session = pipeline.create({
    preprocess: core.preprocess,
    analyze: async () => ({ parser: "test", diagnostics: [] }),
    parse: core.parse
  });
  const result = await session.run('ConOut("OK")');
  assert.equal(result.executed, true);
  assert.equal(result.program.preprocessor.artifact.kind, "didactic-ppo");
  assert.deepEqual(result.analysis.preprocessing.artifact, result.program.preprocessor.artifact);
  const blocked = await session.run('#ifdef X');
  assert.equal(blocked.executed, false);
  assert.equal(blocked.analysis.preprocessing.artifact.kind, "didactic-ppo");
});

test("expande macros recursivas sem alterar strings e comentários", () => {
  const result = preprocessor.process('#define BASE 40\n#define TOTAL BASE + 2\nLocal n := TOTAL\nLocal c := "TOTAL" // TOTAL');
  assert.equal(result.source.split("\n")[2], "Local n := 40 + 2");
  assert.equal(result.source.split("\n")[3], 'Local c := "TOTAL" // TOTAL');
  assert.deepEqual(result.diagnostics, []);
});

test("processa undef e condicionais aninhadas", () => {
  const result = preprocessor.process('#define WEB 1\n#ifdef WEB\n#ifndef DESKTOP\nMsgInfo("Web", "Ambiente")\n#else\nMsgInfo("Desktop", "Ambiente")\n#endif\n#endif\n#undef WEB');
  assert.match(result.source, /MsgInfo\("Web"/);
  assert.doesNotMatch(result.source, /MsgInfo\("Desktop"/);
  assert.equal(result.definitions.WEB, undefined);
});

test("aceita símbolos fornecidos pelo perfil e preserva o mapa de linhas", () => {
  const result = preprocessor.process('#ifdef PROTHEUS\nConOut("Ativo")\n#endif', { defines: { PROTHEUS: 1 } });
  assert.equal(result.source.split("\n")[1], 'ConOut("Ativo")');
  assert.deepEqual(result.map[1], { generatedLine: 2, originalLine: 2, originalColumn: 1 });
});

test("diagnostica diretivas inválidas e condicionais não encerradas", () => {
  const result = preprocessor.process('#ifdef FLAG\n#else\n#else\n#unknown X');
  assert.deepEqual(result.diagnostics.map(item => item.code), ["PP0003", "PP0001", "PP0004"]);
  assert.equal(result.diagnostics.every(item => item.origin === "preprocessor"), true);
});

test("detecta ciclos de expansão sem entrar em recursão infinita", () => {
  const result = preprocessor.process('#define A B\n#define B A\nConOut(A)');
  assert.equal(result.diagnostics.some(item => item.code === "PP0005" && item.severity === "error"), true);
});

test("reconhece include sem carregar arquivo e preserva a execução", () => {
  const result = preprocessor.process('#include "TOTVS.CH"\nConOut("OK")');
  assert.equal(result.source.split("\n")[0], "");
  assert.deepEqual(result.diagnostics.map(item => [item.code, item.severity]), [["PP0006", "warning"]]);
});

test("integra condicionais ao núcleo e bloqueia erros antes da análise assíncrona", async () => {
  const program = core.parse('#define TITULO "Correto"\n#ifdef ATIVO\nMsgInfo("Errado", "Teste")\n#else\nMsgInfo(TITULO, "Teste")\n#endif');
  assert.equal(program.message.text, "Correto");
  assert.equal(program.preprocessor.version, "0.1");
  let analyzed = false;
  const session = pipeline.create({ preprocess: core.preprocess, analyze: async () => { analyzed = true; return { parser: "test", diagnostics: [] }; }, parse: core.parse });
  const execution = await session.run('#ifdef X\nConOut("X")');
  assert.equal(execution.executed, false);
  assert.equal(execution.analysis.parser, "preprocessor");
  assert.equal(analyzed, false);

  const successful = pipeline.create({ preprocess: core.preprocess, analyze: async () => ({ parser: "test", diagnostics: [] }), parse: core.parse });
  const included = await successful.run('#include "TOTVS.CH"\nConOut("OK")');
  assert.equal(included.program.diagnostics.filter(item => item.code === "PP0006").length, 1);
});
