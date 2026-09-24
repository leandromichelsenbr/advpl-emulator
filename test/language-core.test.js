const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const language = require("../src/advpl-language-core.js");

const fixture = fs.readFileSync(path.join(__dirname, "fixtures/ppo-input/message.ppo"), "utf8");

test("constrói AST 0.1 experimental com posições a partir do PPO sintético", () => {
  const ast = language.parse(fixture, { filename: "message.ppo" });
  assert.equal(ast.astVersion, "0.1");
  assert.equal(ast.sourceType, "ppo");
  assert.equal(ast.experimental, true);
  assert.deepEqual(ast.diagnostics, []);
  assert.equal(ast.body[0].type, "FunctionDeclaration");
  assert.equal(ast.body[0].name, "PpoDemo");
  assert.equal(ast.body[0].loc.start.file, "message.ppo");
  assert.deepEqual(ast.body[0].body.map(node => node.type), ["LocalDeclaration", "ExpressionStatement", "ExpressionStatement", "ExpressionStatement", "ReturnStatement"]);
});

test("preserva precedência, chamadas e literais sem executar a AST", () => {
  const ast = language.parse('User Function Demo()\nLocal nTotal := 2 + 3 * 4\nMsgInfo("Total: " + cValToChar(nTotal), "PPO")\nReturn');
  const local = ast.body[0].body[0], message = ast.body[0].body[1].expression;
  assert.equal(local.init.type, "BinaryExpression");
  assert.equal(local.init.operator, "+");
  assert.equal(local.init.right.operator, "*");
  assert.equal(message.type, "CallExpression");
  assert.equal(message.callee.name, "MsgInfo");
  assert.equal(message.arguments[0].type, "BinaryExpression");
});

test("binder inicial registra funções, parâmetros e locais sem resolver APIs externas", () => {
  const ast = language.parse('Static Function Sum(a, b)\nLocal result := a + b\nReturn result');
  const bound = language.bind(ast), fn = bound.functions.SUM;
  assert.deepEqual(bound.diagnostics, []);
  assert.equal(fn.visibility, "static");
  assert.equal(fn.symbols.A.kind, "parameter");
  assert.equal(fn.symbols.RESULT.kind, "local");
  assert.equal(fn.symbols.MSGINFO, undefined);
});

test("lexer e parser produzem diagnósticos posicionados e não lançam por fonte inválido", () => {
  const ast = language.parse('User Function Broken(\nLocal := "texto', { filename: "broken.ppo" });
  assert.equal(ast.diagnostics.length > 0, true);
  assert.equal(ast.diagnostics.every(item => item.origin === "language-core" && item.file === "broken.ppo"), true);
  assert.equal(ast.loc.start.line, 1);
});

test("binder diagnostica símbolos duplicados sem alterar a AST", () => {
  const ast = language.parse('User Function Dup(a)\nLocal a := 1\nReturn a');
  const before = JSON.stringify(ast), bound = language.bind(ast);
  assert.equal(bound.diagnostics.some(item => item.code === "LC0202"), true);
  assert.equal(JSON.stringify(ast), before);
});

test("representa blocos de If/Else, comparações e expressão unária", () => {
  const ast = language.parse('User Function Branch()\nLocal n := -2\nIf n < 0\nMsgInfo("negativo", "Teste")\nElse\nMsgInfo("positivo", "Teste")\nEndIf\nReturn');
  assert.deepEqual(ast.diagnostics, []);
  const conditional = ast.body[0].body[1];
  assert.equal(conditional.type, "IfStatement");
  assert.equal(conditional.test.operator, "<");
  assert.equal(ast.body[0].body[0].init.type, "UnaryExpression");
  assert.equal(conditional.consequent[0].type, "ExpressionStatement");
  assert.equal(conditional.alternate[0].type, "ExpressionStatement");
});

test("binder encontra locais declarados em blocos condicionais", () => {
  const bound = language.bind(language.parse('User Function Branch()\nIf 1 == 1\nLocal cInside := "sim"\nEndIf\nReturn'));
  assert.deepEqual(bound.diagnostics, []);
  assert.equal(bound.functions.BRANCH.symbols.CINSIDE.kind, "local");
});

test("diagnostica If sem EndIf com posição de origem", () => {
  const ast = language.parse('User Function Broken()\nIf 1 == 1\nConOut("aberto")', { filename: "broken-if.ppo" });
  const missing = ast.diagnostics.find(item => item.code === "LC0101");
  assert.equal(Boolean(missing), true);
  assert.equal(missing.file, "broken-if.ppo");
  assert.equal(missing.line, 3);
});

test("representa atribuições simples e compostas", () => {
  const ast = language.parse('User Function Assign()\nLocal n := 1\nn := n + 2\nn += 3\nReturn n');
  assert.deepEqual(ast.diagnostics, []);
  assert.equal(ast.body[0].body[1].type, "AssignmentStatement");
  assert.equal(ast.body[0].body[1].operator, ":=");
  assert.equal(ast.body[0].body[2].operator, "+=");
});

test("binder rejeita atribuição a símbolo não declarado", () => {
  const bound = language.bind(language.parse('User Function Broken()\nmissing := 1\nReturn'));
  assert.equal(bound.diagnostics.some(item => item.code === "LC0203"), true);
});

test("representa For com Step explícito e passo padrão", () => {
  const ast = language.parse('User Function Loops()\nLocal n\nFor n := 0 To 4 Step 2\nConOut(cValToChar(n))\nNext\nFor n := 1 To 2\nConOut(cValToChar(n))\nNext n\nReturn');
  assert.deepEqual(ast.diagnostics, []);
  const loops = ast.body[0].body.filter(item => item.type === "ForStatement");
  assert.equal(loops.length, 2);
  assert.equal(loops[0].step.value, 2);
  assert.equal(loops[0].step.synthetic, undefined);
  assert.equal(loops[1].step.value, 1);
  assert.equal(loops[1].step.synthetic, true);
  assert.equal(loops[0].body[0].type, "ExpressionStatement");
});

test("diagnostica For sem Next, variável divergente e controle não vinculado", () => {
  const missing = language.parse('User Function Broken()\nLocal n\nFor n := 1 To 2\nConOut(n)', { filename: "broken-for.ppo" });
  assert.equal(missing.diagnostics.some(item => item.code === "LC0101"), true);
  const mismatch = language.parse('User Function Broken()\nLocal n\nFor n := 1 To 2\nNext other\nReturn');
  assert.equal(mismatch.diagnostics.some(item => item.code === "LC0108"), true);
  const unbound = language.bind(language.parse('User Function Broken()\nFor n := 1 To 2\nNext\nReturn'));
  assert.equal(unbound.diagnostics.some(item => item.code === "LC0204"), true);
});
