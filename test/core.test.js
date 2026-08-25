const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/advpl-core.js");
const sampleData = require("../data/sample-data.js");

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

test("mantém o contrato público 0.1 na versão 0.2.0 do pacote", () => {
  assert.equal(core.VERSION, "0.1.0");
  assert.equal(core.API_VERSION, "0.1");
  assert.equal(core.PACKAGE_VERSION, "0.2.0");
});
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

test("executa If/Else, Abs, cValToChar e MsgStop sem diálogo", () => {
  const program = core.parse(`User Function abs1()
Local nPessoas := 20
Local nLugares := 18
If nPessoas < nLugares
  MsgInfo("Existem " + cValToChar(nLugares - nPessoas) + " disponíveis")
Else
  MsgStop("Existem " + cValToChar(Abs(nLugares - nPessoas)) + " faltando")
EndIf
Return`);
  assert.equal(program.kind, "message");
  assert.deepEqual(program.message, { kind: "stop", text: "Existem 2 faltando", title: "TOTVS" });
  assert.equal(program.diagnostics.length, 1);
  assert.deepEqual(program.diagnostics[0], {
    code: "W0008", severity: "warning", message: "Too few parameters calling MsgInfo",
    line: 5, column: 3, functionName: "MsgInfo", expectedMinimum: 2, received: 1,
    origin: "emulator-signatures"
  });
});

test("expõe diagnósticos de assinatura sem executar o fonte", () => {
  assert.equal(core.diagnose('MsgInfo("Texto")')[0].code, "W0008");
  assert.equal(core.diagnose('MsgInfo("Texto", "Título")').length, 0);
});

test("registra ConOut como saída de console", () => {
  const program = core.parse(`User Function abs2()
Local nValue := -123.45
ConOut(Abs(nValue)) // Resultado: 123.45
Return`);
  assert.equal(program.kind, "console");
  assert.deepEqual(program.console, ["123.45"]);
  assert.equal(program.variables.nValue, -123.45);
});

test("executa ACopy e monta MsgInfo multilinha", () => {
  const program = core.parse(`#DEFINE CRLF Chr(13)+Chr(10)
User Function Exemplo()
Local aExemplo := {1,2,{11,22,33}}, aBkp := {,,{,,}}
Local cMensagem := ""
cMensagem += "Dimensão de AExemplo = " + cValToChar(Len(aExemplo)) + CRLF
cMensagem += "aExemplo[3][2] = " + cValToChar(aExemplo[3][2]) + CRLF
cMensagem += "Dimensão inicial da Cópia = " + cValToChar(Len(aBkp)) + CRLF
ACopy(aExemplo,aBkp)
cMensagem += "Dimensão atual do Cópia = " + cValToChar(Len(aBkp)) + CRLF
cMensagem += "Cópia[3][3] = " + cValToChar(aBkp[3][3])
Return MsgInfo(cMensagem,"Exemplo do ACopy")`);
  assert.equal(program.kind, "message");
  assert.equal(program.message.kind, "info");
  assert.equal(program.message.title, "Exemplo do ACopy");
  assert.equal(program.message.text, "Dimensão de AExemplo = 3\r\naExemplo[3][2] = 22\r\nDimensão inicial da Cópia = 3\r\nDimensão atual do Cópia = 3\r\nCópia[3][3] = 33");
  assert.equal(program.diagnostics.length, 0);
});

test("interpreta MSDialog():New e os blocos de Activate", () => {
  const program = core.parse(`#include "TOTVS.CH"
User Function MSDialog()
  Local oDlg := MSDialog():New(180,180,550,700,'Exemplo MSDialog',,,,,CLR_BLACK,CLR_WHITE,,,.T.)
  oDlg:Activate(,,,.T.,{||msgstop('validou!'),.T.},,{||msgstop('iniciando?')} )
Return`);
  assert.equal(program.dialog.title, "Exemplo MSDialog");
  assert.equal(program.dialog.right - program.dialog.left, 520);
  assert.equal(program.dialog.bottom - program.dialog.top, 370);
  assert.equal(program.dialog.centered, true);
  assert.deepEqual(core.parseAction(program.dialog.initialization).map(action => action.type), ["message"]);
  assert.deepEqual(core.parseAction(program.dialog.validation).map(action => action.type), ["message", "return"]);
});

test("interpreta TWBrowse com array e duplo clique", () => {
  const program = core.parse(`User Function TWBrowse()
DEFINE DIALOG oDlg TITLE "Exemplo TWBrowse" FROM 180,180 TO 550,700 PIXEL
oBrowse := TWBrowse():New(01,01,260,184,,{'','Codigo','Descrição'},{20,30,30},oDlg)
aBrowse := {{.T.,'CLIENTE 001','RUA CLIENTE 001','BAIRRO CLIENTE 001'},;
{.F.,'CLIENTE 002','RUA CLIENTE 002','BAIRRO CLIENTE 002'}}
oBrowse:SetArray(aBrowse)
oBrowse:bLDblClick := {|| aBrowse[oBrowse:nAt][1] := !aBrowse[oBrowse:nAt][1], oBrowse:DrawSelect()}
ACTIVATE DIALOG oDlg CENTERED
Return`);
  const browse = program.controls[0];
  assert.equal(program.dialog.title, "Exemplo TWBrowse");
  assert.equal(program.dialog.centered, true);
  assert.equal(browse.type, "BROWSE");
  assert.equal(browse.row, 2);
  assert.equal(browse.col, 2);
  assert.equal(browse.width, 520);
  assert.equal(browse.height, 368);
  assert.deepEqual(browse.headers, ["", "Codigo", "Descrição"]);
  assert.equal(browse.rows.length, 2);
  assert.equal(browse.rows[0][0], true);
  assert.equal(browse.toggleOnDoubleClick, true);
});

test("interpreta BrGetDDB com TCColumn e callbacks", () => {
  const program = core.parse(`#include 'totvs.ch'
User Function teste()
Local oDlg := Nil
DEFINE DIALOG oDlg TITLE "Exemplo BrGetDDB" FROM 180,180 TO 550,700 PIXEL
dbSelectArea('SA1')
oBrowse := BrGetDDB():New(1,1,260,184,,,,oDlg,,,,,,,,,,,,.F.,'SA1',.T.,,.F.,,,)
oBrowse:bCustomEditCol := {|x,y,z| u_editLine(x,y,z)}
oBrowse:bDelete := {|| conOut("bDelete")}
oBrowse:AddColumn(TCColumn():New('Codigo',{|| SA1->A1_COD},,,,'LEFT',,.F.,.F.,,,,.F.))
oBrowse:AddColumn(TCColumn():New('Loja',{|| SA1->A1_LOJA},,,,'LEFT',,.F.,.F.,,,,.F.))
oBrowse:AddColumn(TCColumn():New('Nome',{|| SA1->A1_NOME},,,,'LEFT',,.F.,.F.,,,,.F.))
ACTIVATE DIALOG oDlg CENTERED
Return Nil`, { tables: sampleData.tables });
  const browse = program.controls[0];
  assert.equal(program.dialog.title, "Exemplo BrGetDDB");
  assert.equal(browse.type, "GETDADOS");
  assert.equal(browse.width, 520);
  assert.equal(browse.height, 368);
  assert.equal(browse.dataSource, "SA1");
  assert.deepEqual(browse.headers, ["Codigo", "Loja", "Nome"]);
  assert.deepEqual(browse.columns.map(column => column.field), ["A1_COD", "A1_LOJA", "A1_NOME"]);
  assert.equal(browse.customEdit, true);
  assert.equal(browse.deleteAction, true);
  assert.equal(browse.dataMode, "sample");
  assert.equal(browse.rows.length, 5);
  assert.deepEqual(browse.rows[0], ["000001", "01", "CLIENTE EXEMPLO 001"]);
});

test("interpreta TCBrowse, eventos e botões de navegação", () => {
  const program = core.parse(`User Function TCBrowse()
DEFINE DIALOG oDlg TITLE "Exemplo TCBrowse" FROM 180,180 TO 550,700 PIXEL
aBrowse := {{.T.,'CLIENTE 001','RUA CLIENTE 001',111.11},{.F.,'CLIENTE 002','RUA CLIENTE 002',222.22},{.T.,'CLIENTE 003','RUA CLIENTE 003',333.33}}
oBrowse := TCBrowse():New(1,1,260,156,,{'','Codigo','Nome','Valor'},{20,50,50,50},oDlg)
oBrowse:SetArray(aBrowse)
oBrowse:bLine := {||{If(aBrowse[oBrowse:nAt,1],oOK,oNO),aBrowse[oBrowse:nAt,2],aBrowse[oBrowse:nAt,3],Transform(aBrowse[oBrowse:nAt,4],'@E 99,999,999,999.99')}}
oBrowse:bHeaderClick := {|o,nCol| alert('bHeaderClick')}
oBrowse:bLDblClick := {|| alert('bLDblClick')}
TButton():New(160,2,"GoUp()",oDlg,{||oBrowse:GoUp(),oBrowse:SetFocus()},40,10)
TButton():New(160,52,"GoDown()",oDlg,{||oBrowse:GoDown(),oBrowse:SetFocus()},40,10)
TButton():New(172,2,"Linha atual",oDlg,{||alert(oBrowse:nAt)},40,10)
TButton():New(172,52,"Nr Linhas",oDlg,{||alert(oBrowse:nLen)},40,10)
ACTIVATE DIALOG oDlg CENTERED
Return`);
  const browse = program.controls[0];
  const buttons = program.controls.filter(control => control.type === "TBUTTON");
  assert.equal(browse.sourceClass, "TCBrowse");
  assert.equal(browse.height, 312);
  assert.deepEqual(browse.headers, ["", "Codigo", "Nome", "Valor"]);
  assert.equal(browse.headerClick, true);
  assert.equal(browse.doubleClickMessage, "bLDblClick");
  assert.equal(browse.formats[3], "@E 99,999,999,999.99");
  assert.equal(buttons.length, 4);
  assert.deepEqual(buttons.map(button => button.browseCommand), ["GoUp", "GoDown", "nAt", "nLen"]);
  assert.deepEqual([buttons[0].row, buttons[0].col, buttons[0].width, buttons[0].height], [320, 4, 80, 20]);
});

test("interpreta fluxo FWMSPrinter e relatório A4", () => {
  const program = core.parse(`User Function teste()
If MsgYesNo("Deseja gerar o relatório de grupos de produtos?", "Atenção")
  Processa({|| fMontaRel()}, "Processando...")
EndIf
Static Function fMontaRel()
oPrintPvt := FWMSPrinter():New("zTstRel", IMP_PDF)
oPrintPvt:SetResolution(72)
oPrintPvt:SetPortrait()
oPrintPvt:SetPaperSize(DMPAPER_A4)
oPrintPvt:SetMargin(60,60,60,60)
cTexto := "Relação de Grupos de Produtos"
oPrintPvt:SayAlign(nLinCab, COL_GRUPO, "Grupo", oFontDetN, 80, 10)
oPrintPvt:SayAlign(nLinCab, COL_DESCR, "Descrição", oFontDetN, 200, 10)
oPrintPvt:Preview()
Return`);
  assert.equal(program.kind, "report");
  assert.equal(program.confirmation.title, "Atenção");
  assert.equal(program.report.engine, "FWMSPrinter");
  assert.equal(program.report.paper, "A4");
  assert.equal(program.report.orientation, "portrait");
  assert.deepEqual(program.report.headers, ["Grupo", "Descrição"]);
  assert.equal(program.report.rows.length, 7);
});

test("interpreta Setup, Say e códigos EAN13", () => {
  const program = core.parse(`User Function teste()
Local oPrinter
oPrinter := FWMSPrinter():New("exemplo.rel", IMP_PDF, .F., "\\spool", .T.)
oPrinter:Say(20,30,"Código de barras EAN13:")
oPrinter:Ean13(180/*nRow*/,280/*nCol*/,"876543210987"/*cCode*/,100/*nWidth*/,95/*nHeight*/)
oPrinter:Ean13(300,30,"123456789012",200,95)
oPrinter:Setup()
If oPrinter:nModalResult == PD_OK
  oPrinter:Preview()
EndIf
Return`);
  assert.equal(program.kind, "report");
  assert.equal(program.setup.enabled, true);
  assert.equal(program.confirmation, null);
  assert.equal(program.report.layout, "absolute");
  assert.deepEqual(program.report.elements[0], { type: "text", row: 20, col: 30, text: "Código de barras EAN13:", font: null, width: 0, color: "#000000" });
  assert.deepEqual(program.report.elements[1], { type: "ean13", row: 180, col: 280, code: "876543210987", width: 100, height: 95 });
});

test("interpreta QRCode em relatório com Setup", () => {
  const program = core.parse(`User Function teste()
Local oPrinter
oPrinter := FWMSPrinter():New('teste',6,.F.,,.T.,,,,,.F.)
oPrinter:Setup()
oPrinter:setDevice(IMP_PDF)
oPrinter:QRCode(150,150,"QR Code gerado com sucesso",100)
oPrinter:EndPage()
oPrinter:Preview()
Return`);
  assert.equal(program.setup.enabled, true);
  assert.equal(program.report.layout, "absolute");
  assert.deepEqual(program.report.elements, [{ type: "qrcode", row: 150, col: 150, content: "QR Code gerado com sucesso", size: 100 }]);
});

test("interpreta TMSPrinter e comandos gráficos legados", () => {
  const program = core.parse(`User Function teste()
oPrint := TMSPrinter():New("Exemplo TMSPrinter")
oPrint:SetPortrait()
oPrint:Setup()
oPrint:StartPage()
oFont1 := TFont():New('Courier new',,-18,.T.)
oPrint:Say(10,10,"Texto para visualização",oFont1,1400,CLR_HRED)
oPrint:SayBitmap(100,200,"C:\\Dir\\Totvs.bmp",400,400)
oPrint:Line(130,10,130,900)
oPrint:Box(130,10,600,900)
oBrush1 := TBrush():New(,CLR_YELLOW)
oPrint:FillRect({100,10,200,200},oBrush1)
oPrint:EndPage()
oPrint:Preview()
Return`);
  assert.equal(program.report.engine, "TMSPrinter");
  assert.equal(program.report.title, "Exemplo TMSPrinter");
  assert.equal(program.report.rows.length, 0);
  assert.equal(program.report.templateId, null);
  assert.equal(program.setup.variant, "legacy");
  assert.deepEqual(program.report.coordinateSystem, { scale: 0.24, offsetX: 8.4, offsetY: 14.16 });
  assert.deepEqual(program.report.elements.map(element => element.type), ["text", "line", "box", "fill", "bitmap"]);
  assert.equal(program.report.elements.find(element => element.type === "text").color, "#ff0000");
  assert.equal(program.report.elements.find(element => element.type === "fill").color, "#ffff00");
});

test("SetLandscape define página A4 em paisagem", () => {
  const program = core.parse(`User Function teste()
oPrinter := FWMSPrinter():New("paisagem.rel", IMP_PDF)
oPrinter:SetLandscape()
oPrinter:Setup()
oPrinter:Say(20,30,"Paisagem")
oPrinter:Preview()
Return`);
  assert.equal(program.report.orientation, "landscape");
  assert.equal(program.report.orientationSource, "SetLandscape");
  assert.equal(program.report.paper, "custom");
});
