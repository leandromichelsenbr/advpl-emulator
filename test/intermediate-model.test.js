const test = require("node:test");
const assert = require("node:assert/strict");
const model = require("../src/advpl-model.js");
const core = require("../src/advpl-core.js");
const sampleData = require("../data/sample-data.js");

test("finaliza e valida o envelope comum do modelo 0.1", () => {
  const program = model.finalize({ kind: "console", console: ["OK"] });

  assert.equal(program.modelVersion, "0.1");
  assert.equal(program.outputType, "console");
  assert.deepEqual(program.events, []);
  assert.deepEqual(program.controls, []);
  assert.deepEqual(program.diagnostics, []);
  assert.equal(model.validate(program).valid, true);
  assert.equal(model.validate({ ...program, outputType: "report" }).valid, false);
});

test("classifica e valida todas as famílias produzidas pelo núcleo", () => {
  const tables = sampleData.tables;
  const programs = [
    core.parse('User Function M()\nMsgInfo("OK")\nReturn'),
    core.parse('User Function C()\nConOut("OK")\nReturn'),
    core.parse('User Function D()\nLocal oDlg\nDEFINE MSDIALOG oDlg TITLE "D" FROM 0,0 TO 100,200\nACTIVATE MSDIALOG oDlg CENTERED\nReturn'),
    core.parse('User Function B()\nLocal oBrowse := FWMBrowse():New()\noBrowse:SetAlias("SA1")\noBrowse:Activate()\nReturn', { tables }),
    core.parse('User Function R()\nLocal oPrn := FWMSPrinter():New("R")\noPrn:Preview()\nReturn')
  ];

  assert.deepEqual(programs.map(program => program.outputType), ["message", "console", "dialog", "grid", "report"]);
  for (const program of programs) {
    assert.equal(program.modelVersion, "0.1");
    assert.deepEqual(core.validateModel(program), { valid: true, errors: [] });
  }
});
