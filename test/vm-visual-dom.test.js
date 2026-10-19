const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const root = path.join(__dirname, "..");
const source = 'User Function Demo()\nLocal n := 10\nLocal b := {|x| n += x, MsgInfo(cValToChar(n), "Total"), n}\nConOut("antes")\nConOut(cValToChar(Eval(b, 2)))\nConOut(cValToChar(Eval(b, 3)))\nConOut("depois")\nReturn n';
const tick = () => new Promise(resolve => setImmediate(resolve));

async function load(page = "index.html") {
  const dom = new JSDOM(fs.readFileSync(path.join(root, page), "utf8"), { url: "https://emulator.test/" + page, runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  window.ADVPL_EMULATOR_CONFIG = { parserMode: "light", preprocessor: { builtinIncludes: false } };
  window.document.getElementById("source").value = 'User Function Init()\nConOut("pronto")\nReturn';
  for (const script of window.document.querySelectorAll("script[src]")) {
    const file = script.getAttribute("src").split("?")[0];
    window.eval(fs.readFileSync(path.join(root, file), "utf8") + '\n//# sourceURL=' + file);
  }
  await tick();
  return dom;
}
function message(doc) { return doc.querySelector("#desktop wa-message-box p")?.textContent; }
function ok(doc) { return doc.querySelector("#desktop wa-message-box button"); }
function consoleText(doc) { return doc.querySelector("#desktop .console-panel")?.textContent || ""; }

for (const page of ["index.html", "exercise.html"]) {
  test(page + ": Executar código e OK continuam a VM com mensagens e console em ordem", async t => {
    const dom = await load(page); t.after(() => dom.window.close());
    const { window } = dom, doc = window.document;
    assert.equal(doc.getElementById("executionEngine").value, "legacy");
    doc.getElementById("executionEngine").value = "vm";
    doc.getElementById("executionEngine").dispatchEvent(new window.Event("change"));
    doc.getElementById("source").value = source;
    doc.getElementById("runButton").click(); await tick();
    assert.equal(message(doc), "12");
    assert.equal(consoleText(doc), "antes");
    assert.equal(doc.getElementById("cancelExecution").hidden, false);
    const first = ok(doc); first.click();
    assert.equal(message(doc), "15");
    assert.equal(consoleText(doc), "antes\n12");
    first.click(); // evento repetido do botão já removido não avança a próxima pausa
    assert.equal(message(doc), "15");
    ok(doc).click();
    assert.equal(message(doc), undefined);
    assert.equal(consoleText(doc), "antes\n12\n15\ndepois");
    assert.match(doc.getElementById("status").textContent, /Execução concluída/);
    assert.equal(doc.getElementById("cancelExecution").hidden, true);
    doc.querySelector(".run-again").click(); await tick();
    assert.equal(message(doc), "12"); assert.equal(consoleText(doc), "antes");
  });
}

test("cancelamento e botão antigo não retomam uma sessão substituída", async t => {
  const dom = await load(); t.after(() => dom.window.close());
  const { window } = dom, doc = window.document;
  const first = await window.AdvPLEmulator.runAsync(source, undefined, { engine: "vm" });
  const oldButton = ok(doc);
  doc.getElementById("cancelExecution").click();
  assert.equal(first.execution.snapshot().state, "cancelled");
  assert.equal(message(doc), undefined);
  assert.equal(consoleText(doc), "antes");
  const newer = await window.AdvPLEmulator.runAsync('User Function Newer()\nMsgInfo("novo")\nReturn 9', undefined, { engine: "vm" });
  oldButton.click();
  assert.equal(message(doc), "novo");
  assert.equal(newer.execution.snapshot().state, "suspended");
  ok(doc).click(); assert.equal(newer.execution.snapshot().value, 9);
});

test("uma nova execução e mudança de modo cancelam a VM anterior", async t => {
  const dom = await load(); t.after(() => dom.window.close());
  const { window } = dom, doc = window.document;
  const previous = await window.AdvPLEmulator.runAsync(source, undefined, { engine: "vm" });
  const button = ok(doc);
  await window.AdvPLEmulator.runAsync('User Function Latest()\nConOut("atual")\nReturn', undefined, { engine: "vm" });
  assert.equal(previous.execution.snapshot().state, "cancelled");
  button.click(); assert.equal(consoleText(doc), "atual");
  const paused = await window.AdvPLEmulator.runAsync(source, undefined, { engine: "vm" });
  doc.getElementById("executionEngine").value = "legacy";
  doc.getElementById("executionEngine").dispatchEvent(new window.Event("change"));
  assert.equal(paused.execution.snapshot().state, "cancelled");
  assert.equal(message(doc), undefined);
});

test("erros do Language Core bloqueiam toda saída, incluindo console anterior", async t => {
  const dom = await load(); t.after(() => dom.window.close());
  const { window } = dom, doc = window.document;
  const result = await window.AdvPLEmulator.runAsync('User Function Broken()\nConOut("não executar")\nReturn missing', undefined, { engine: "vm" });
  assert.equal(result.executed, false);
  assert.equal(consoleText(doc), ""); assert.equal(message(doc), undefined);
  assert.match(doc.querySelector(".diagnostics").textContent, /LC0302/);
  assert.equal(doc.getElementById("runButton").disabled, false);
});

test("falha de runtime e limite de passos após OK são apresentados sem repetir saídas", async t => {
  const dom = await load(); t.after(() => dom.window.close());
  const { window } = dom, doc = window.document;
  const result = await window.AdvPLEmulator.runAsync('User Function Demo()\nMsgInfo("início")\nWhile 1 == 1\nEndDo\nReturn', undefined, { engine: "vm", vm: { maxSteps: 30 } });
  ok(doc).click();
  assert.equal(result.execution.snapshot().state, "failed");
  assert.match(doc.querySelector(".diagnostics").textContent, /LC_RUNTIME_STEP_LIMIT/);
  assert.match(doc.getElementById("status").textContent, /interrompida/);
  assert.equal(doc.getElementById("cancelExecution").hidden, true);
});

test("API síncrona e modo clássico continuam renderizando os componentes existentes", async t => {
  const dom = await load("exercise.html"); t.after(() => dom.window.close());
  const { window } = dom, doc = window.document;
  const legacy = 'User Function Demo()\nLocal oDlg\nDEFINE MSDIALOG oDlg TITLE "Clássico" FROM 0,0 TO 120,300 PIXEL\nACTIVATE MSDIALOG oDlg CENTERED\nReturn';
  const result = await window.AdvPLEmulator.runAsync(legacy, undefined, { engine: "legacy" });
  assert.equal(result.executed, true);
  assert.equal(doc.querySelector('#desktop [data-advpl="tdialog"]').getAttribute("title"), "Clássico");
  assert.equal(doc.getElementById("executionHint").hidden, true);
  assert.throws(() => window.AdvPLEmulator.run(source, undefined, { engine: "vm" }), /runAsync/);
  window.AdvPLEmulator.run('User Function Demo()\nConOut("legado")\nReturn');
  assert.equal(consoleText(doc), "legado");
});

test("resposta sintática atrasada não substitui a mensagem da execução mais recente", async t => {
  const dom = await load(); t.after(() => dom.window.close());
  const { window } = dom, doc = window.document;
  let release, calls = 0;
  const valid = { parser: "light", diagnostics: [], fallbackUsed: false };
  window.AdvPLParserAdapter = { analyze: () => ++calls === 1 ? new Promise(resolve => { release = resolve; }) : Promise.resolve(valid) };
  const old = window.AdvPLEmulator.runAsync(source, undefined, { engine: "vm" });
  await tick();
  const latest = await window.AdvPLEmulator.runAsync('User Function Latest()\nMsgInfo("atual")\nReturn', undefined, { engine: "vm" });
  release(valid);
  assert.equal((await old).stale, true);
  assert.equal(latest.executed, true);
  assert.equal(message(doc), "atual");
  assert.equal(doc.getElementById("runButton").disabled, false);
});

test("edição durante carregamento de includes não troca o fonte já solicitado", async t => {
  const dom = await load(); t.after(() => dom.window.close());
  const { window } = dom, doc = window.document;
  let release;
  window.AdvPLIncludeLoader = { load: () => new Promise(resolve => { release = resolve; }) };
  const requested = window.AdvPLEmulator.runAsync(source, undefined, { engine: "vm", preprocessor: { builtinIncludes: true } });
  await tick();
  doc.getElementById("source").value = 'User Function Changed()\nMsgInfo("editado")\nReturn';
  release({ includes: {}, catalog: {} });
  assert.equal((await requested).executed, true);
  assert.equal(message(doc), "12");
  assert.equal(consoleText(doc), "antes");
});
