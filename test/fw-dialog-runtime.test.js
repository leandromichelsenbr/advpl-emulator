const test = require('node:test');
const assert = require('node:assert/strict');

const runtime = require('../src/fw-dialog-runtime.js');

test('interpreta FWMsgAlertYesNo seguido de ShowLog', () => {
  const source = `#Include "TOTVS.ch"

User Function Teste(cConsulta)
Default cConsulta := "SELECT * FROM SA1010 WHERE A1_FILIAL = '01' AND A1_COD = '0000000001'"

If ! IsBlind() .And. ! Empty(cConsulta) .And. FWIsAdmin()
    If FWMsgAlertYesNo("Deseja visualizar a consulta?", "Atenção (" + FunName() + ")")
        ShowLog(cConsulta)
    EndIf
EndIf

Return`;

  const program = runtime.parseProgram(source);

  assert.ok(program);
  assert.equal(program.kind, 'fw-confirm-showlog');
  assert.equal(program.functionName, 'TESTE');
  assert.equal(program.confirmation.message, 'Deseja visualizar a consulta?');
  assert.equal(program.confirmation.title, 'Atenção (TESTE)');
  assert.equal(program.log.text, "SELECT * FROM SA1010 WHERE A1_FILIAL = '01' AND A1_COD = '0000000001'");
  assert.equal(program.log.title, 'Log de ocorrências - Pré-Geração');
});

test('mantém compatibilidade com FWAlertYesNo', () => {
  const source = `User Function Teste()
Local cTexto := "ABC"
If FWAlertYesNo("Visualizar?", "Teste")
    ShowLog(cTexto)
EndIf
Return`;

  const program = runtime.parseProgram(source);

  assert.ok(program);
  assert.equal(program.confirmation.message, 'Visualizar?');
  assert.equal(program.confirmation.title, 'Teste');
  assert.equal(program.log.text, 'ABC');
});

test('não intercepta fontes sem ShowLog', () => {
  const source = `User Function Teste()
FWMsgAlertYesNo("Continuar?", "Teste")
Return`;

  assert.equal(runtime.parseProgram(source), null);
});
