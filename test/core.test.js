const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/advpl-core.js");

const source = `User Function MinhaTela()
Local oDlg
Local cNome := Space(40)
Local nIdade := 0
DEFINE MSDIALOG oDlg TITLE "Cadastro" FROM 0,0 TO 120,300
@ 10,10 SAY "Nome:" OF oDlg
@ 10,40 MSGET cNome SIZE 150,10 OF oDlg
@ 30,40 MSGET nIdade SIZE 50,10 OF oDlg
@ 70,10 BUTTON "Confirmar" ACTION (MsgInfo("Olá, " + AllTrim(cNome)), oDlg:End()) OF oDlg
ACTIVATE MSDIALOG oDlg CENTERED
Return`;

test("expõe uma versão estável", () => assert.equal(core.VERSION, "0.1.0"));
test("interpreta MSDialog e MSGET", () => {
  const program = core.parse(source);
  assert.equal(program.dialog.title, "Cadastro");
  assert.equal(program.dialog.centered, true);
  assert.equal(program.controls.length, 4);
  assert.equal(program.controls[1].type, "GET");
  assert.equal(program.controls[1].boundVar, "cNome");
  assert.equal(program.variables.cNome.length, 40);
  assert.equal(program.variables.nIdade, 0);
});
test("avalia Space, AllTrim e concatenação", () => assert.equal(core.evaluate('"Olá, " + AllTrim(cNome)', { cNome: "  Leandro  " }), "Olá, Leandro"));
test("preserva a ordem das ações compostas", () => assert.deepEqual(core.parseAction('(MsgInfo("OK"), oDlg:End())').map(action => action.type), ["message", "end"]));
