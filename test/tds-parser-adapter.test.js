const test = require("node:test");
const assert = require("node:assert/strict");
const adapter = require("../src/tds-parser-adapter.js");
const { parser } = require("@totvs/tds-parsers");

test("normaliza a AST do parser TDS sem substituir o executor", async () => {
  const result = await adapter.analyze('User Function Teste()\nAlert("Oi")\nReturn', { mode: "tds", parser });
  assert.equal(result.parser, "tds-parsers@0.1.5");
  assert.equal(result.ast.type, "program");
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.fallbackUsed, false);
});

test("normaliza erro sintático com origem e posição", async () => {
  const result = await adapter.analyze('User Function Teste()\nLocal c := "sem fim\nReturn', { mode: "tds", parser });
  assert.equal(result.ast, null);
  assert.equal(result.diagnostics[0].origin, "tds-parser");
  assert.equal(result.diagnostics[0].severity, "error");
  assert.equal(result.diagnostics[0].line, 3);
  assert.equal(result.diagnostics[0].column, 7);
});

test("modo automático recua para o parser leve quando o avançado não carrega", async () => {
  const result = await adapter.analyze("User Function Teste()\nReturn", { mode: "auto" });
  assert.equal(result.parser, "light");
  assert.equal(result.fallbackUsed, true);
  assert.match(result.fallbackReason, /Web Worker/);
});
