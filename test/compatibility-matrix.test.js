const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const matrixPath = path.join(__dirname, "..", "docs", "compatibility-matrix.md");
const matrix = fs.readFileSync(matrixPath, "utf8");

test("mantém a matriz de compatibilidade completa e classificável", () => {
  const rows = matrix.split(/\r?\n/).filter(line => /^\| (?:LNG|OUT|UI|PRT|UNS)-\d{3} \|/.test(line));
  const ids = [];
  const validStates = new Set(["supported", "partial", "approximated", "recognized", "unsupported"]);

  assert.equal(rows.length, 35, "a quantidade de capacidades inventariadas mudou; revise o catálogo e este contrato");

  for (const row of rows) {
    const cells = row.split("|").slice(1, -1).map(cell => cell.trim());
    const id = cells[0];
    const state = cells[2].replaceAll("`", "");

    assert.ok(id, "toda capacidade precisa de ID");
    assert.ok(cells[1], `${id} precisa de nome`);
    assert.ok(validStates.has(state), `${id} possui estado inválido: ${state}`);
    assert.ok(cells[3], `${id} precisa declarar cobertura ou comportamento atual`);
    ids.push(id);
  }

  assert.equal(new Set(ids).size, ids.length, "os IDs da matriz devem ser únicos");
  assert.match(matrix, /validação manual/i, "lacunas sem automação devem permanecer explícitas");
});
