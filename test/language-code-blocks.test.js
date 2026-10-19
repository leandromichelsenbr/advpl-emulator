const test = require("node:test");
const assert = require("node:assert/strict");
const language = require("../src/advpl-language-core.js");
const compiler = require("../src/advpl-language-compiler.js");
const vm = require("../src/advpl-language-vm.js");
const core = require("../src/advpl-core.js");
const fs = require("node:fs");
const path = require("node:path");

function compile(source) {
  return compiler.compile(language.bind(language.parse(source, { filename: "blocks.ppo" })));
}
function execute(source, options) { return vm.run(compile(source), options); }
function success(result) { assert.equal(result.completed, true); assert.deepEqual(result.diagnostics, []); }

test("fixture PPO sintética executa acumulação por bloco e equivale à lógica direta", () => {
  const source = fs.readFileSync(path.join(__dirname, "fixtures/ppo-input/code-blocks.ppo"), "utf8");
  const result = execute(source);
  success(result); assert.equal(result.value, 6); assert.deepEqual(result.console, ["1", "3", "6"]);
  const legacy = core.parse('User Function Demo()\nLocal total := 0\nLocal i\nFor i := 1 To 3\ntotal += i\nConOut(cValToChar(total))\nNext\nMsgInfo(cValToChar(total), "Resultado")\nReturn');
  assert.deepEqual(result.events, legacy.events);
});

test("AST representa parâmetros, sequência e atribuição de bloco com posições", () => {
  const ast = language.parse('User Function Demo()\nLocal b := {|x, y| ConOut("{|literal|}"), x += y, x * 2}\nReturn', { filename: "blocks.ppo" });
  assert.deepEqual(ast.diagnostics, []);
  const block = ast.body[0].body[0].init;
  assert.equal(block.type, "CodeBlockExpression");
  assert.deepEqual(block.params, ["x", "y"]);
  assert.deepEqual(block.expressions.map(item => item.type), ["CallExpression", "AssignmentExpression", "BinaryExpression"]);
  assert.equal(block.loc.start.file, "blocks.ppo");
  assert.equal(block.loc.start.line, 2);
  assert.equal(block.loc.start.column, 12);
  assert.equal(block.loc.end.offset, ast.body[0].body[0].loc.end.offset);
});

test("blocos malformados produzem diagnósticos sem efeitos", () => {
  for (const block of ['{||}', '{|x| x', '{|1| 1}', '{|x,| x}', '{|| 1,}', '{1}', '{|| missing := 1}']) {
    const result = execute('User Function Demo()\nConOut("não executar")\nLocal b := ' + block + '\nReturn');
    assert.equal(result.completed, false, block);
    assert.equal(result.diagnostics.some(item => item.severity === "error"), true, block);
    assert.deepEqual(result.events, [], block);
  }
});

test("binder rejeita parâmetros duplicados mas permite sombrear o escopo externo", () => {
  const duplicate = language.bind(language.parse('User Function Demo()\nLocal b := {|x, X| x}\nReturn'));
  assert.equal(duplicate.diagnostics.some(item => item.code === "LC0205"), true);
  const bound = language.bind(language.parse('User Function Demo()\nLocal x := 10\nLocal b := {|x| x += 1}\nReturn'));
  assert.deepEqual(bound.diagnostics, []);
  assert.equal(bound.functions.DEMO.symbols.X.kind, "local");
  assert.equal(bound.functions.DEMO.symbols.B.kind, "local");
});

test("compiler descreve capturas locais e transitivas e rejeita leitura não vinculada", () => {
  const bytecode = compile('User Function Demo()\nLocal n := 10\nReturn {|x| {|y| n + x + y}}');
  assert.deepEqual(bytecode.diagnostics, []);
  assert.deepEqual(bytecode.blocks.$BLOCK0.captures, [{ kind: "local", index: 0 }]);
  assert.deepEqual(bytecode.blocks.$BLOCK1.captures, [{ kind: "capture", index: 0 }, { kind: "local", index: 0 }]);
  assert.equal(bytecode.blocks.$BLOCK1.instructions.every(item => item.loc.start.file === "blocks.ppo"), true);
  const unbound = compile('User Function Demo()\nReturn {|| unknown}');
  assert.equal(unbound.diagnostics.some(item => item.code === "LC0302"), true);
});

test("criar bloco não executa efeitos; Eval retorna a última expressão", () => {
  const dormant = execute('User Function Demo()\nLocal b := {|| UnknownCall()}\nReturn 7');
  success(dormant); assert.equal(dormant.value, 7); assert.deepEqual(dormant.events, []);
  const result = execute('User Function Demo()\nLocal b := {|x| ConOut("início"), MsgInfo(cValToChar(x), "Bloco"), x * 2}\nReturn Eval(b, 3)');
  success(result); assert.equal(result.value, 6);
  assert.deepEqual(result.events, [
    { type: "console", text: "início" },
    { type: "message", kind: "info", text: "3", title: "Bloco" }
  ]);
});

test("capturas compartilham a variável e observam alterações posteriores à criação", () => {
  const result = execute('User Function Demo()\nLocal n := 1\nLocal b := {|x| n += x}\nn := 10\nConOut(cValToChar(Eval(b, 2)))\nConOut(cValToChar(Eval(b, 3)))\nReturn n');
  success(result); assert.equal(result.value, 15); assert.deepEqual(result.console, ["12", "15"]);
});

test("parâmetros do bloco têm frame próprio e não alteram escalares do chamador", () => {
  const result = execute('User Function Demo()\nLocal n := 10\nLocal b := {|n| n += 2}\nConOut(cValToChar(Eval(b, n)))\nReturn n');
  success(result); assert.equal(result.value, 10); assert.deepEqual(result.console, ["12"]);
  const missing = execute('User Function Demo()\nReturn Eval({|x| x})');
  success(missing); assert.equal(missing.value, null);
  const extra = execute('User Function Demo()\nReturn Eval({|x| x}, 7, 99)');
  success(extra); assert.equal(extra.value, 7);
});

test("closure retornada preserva estado após o retorno da função e mantém fábricas isoladas", () => {
  const result = execute('User Function Demo()\nLocal a := Counter(1)\nLocal b := Counter(10)\nConOut(cValToChar(Eval(a)))\nConOut(cValToChar(Eval(b)))\nReturn Eval(a)\nStatic Function Counter(n)\nReturn {|| n += 1}');
  success(result); assert.equal(result.value, 3); assert.deepEqual(result.console, ["2", "11"]);
});

test("blocos irmãos e aninhados compartilham a mesma célula capturada", () => {
  const result = execute('User Function Demo()\nLocal n := 1\nLocal first := {|| n += 1}\nLocal factory := {|x| {|y| n += x + y}}\nLocal inner := Eval(factory, 10)\nEval(first)\nEval(inner, 3)\nReturn Eval(first)');
  success(result); assert.equal(result.value, 16);
});

test("blocos podem ser argumentos e atribuições encadeadas retornam seu valor", () => {
  const result = execute('User Function Demo()\nLocal a := 0\nLocal b := 0\nLocal block := {|x| a := b := x, a + b}\nReturn Apply(block, 4)\nStatic Function Apply(block, n)\nReturn Eval(block, n)');
  success(result); assert.equal(result.value, 8);
  assert.deepEqual(result.locals.slice(0, 2), [4, 4]);
});

test("Eval preserva a ordem de avaliação dos argumentos e aceita bloco imediato", () => {
  const result = execute('User Function Demo()\nReturn Eval(Make(), Arg(2), Arg(3))\nStatic Function Make()\nConOut("bloco")\nReturn {|a, b| a + b}\nStatic Function Arg(n)\nConOut(cValToChar(n))\nReturn n');
  success(result); assert.equal(result.value, 5); assert.deepEqual(result.console, ["bloco", "2", "3"]);
  const immediate = execute('User Function Demo()\nReturn Eval({|| 42})');
  success(immediate); assert.equal(immediate.value, 42);
});

test("blocos usam o mesmo orçamento de instruções e limite de frames", () => {
  const source = 'User Function Demo()\nLocal b\nb := {|| Eval(b)}\nReturn Eval(b)';
  const depth = execute(source, { maxCallDepth: 4 });
  assert.equal(depth.completed, false); assert.equal(depth.diagnostics[0].code, "LC_RUNTIME_CALL_DEPTH");
  const steps = execute(source, { maxSteps: 20, maxCallDepth: 128 });
  assert.equal(steps.completed, false); assert.equal(steps.diagnostics[0].code, "LC_RUNTIME_STEP_LIMIT");
  assert.equal(steps.steps, 20);
});

test("Eval rejeita valores comuns e blocos forjados ou de outra execução", () => {
  for (const source of ['User Function Demo()\nReturn Eval(7)', 'User Function Demo()\nReturn Eval(Nil)']) {
    const result = execute(source);
    assert.equal(result.completed, false); assert.equal(result.diagnostics[0].code, "LC_VM_NOT_BLOCK");
  }
  for (const arg of [{ type: "codeblock" }, execute('User Function Demo()\nReturn {|| 1}').value]) {
    const result = execute('User Function Demo(b)\nReturn Eval(b)', { args: [arg] });
    assert.equal(result.completed, false); assert.equal(result.diagnostics[0].code, "LC_VM_NOT_BLOCK");
  }
  assert.equal(compile('User Function Demo()\nReturn Eval()').diagnostics.some(item => item.code === "LC0306"), true);
});

test("VM diagnostica definição e captura inválidas sem lançar", () => {
  const original = compile('User Function Demo()\nLocal n := 1\nReturn Eval({|| n})');
  const absent = structuredClone(original); absent.blocks = {};
  assert.equal(vm.run(absent).diagnostics[0].code, "LC_VM_INVALID_BLOCK");
  const invalid = structuredClone(original); invalid.blocks.$BLOCK0.captures[0].index = 999;
  assert.equal(vm.run(invalid).diagnostics[0].code, "LC_VM_INVALID_CAPTURE");
  const badRead = structuredClone(original); badRead.blocks.$BLOCK0.instructions[0].arg = 999;
  assert.equal(vm.run(badRead).diagnostics[0].code, "LC_VM_INVALID_CAPTURE");
  badRead.blocks.$BLOCK0.instructions[0].arg = "__proto__";
  assert.equal(vm.run(badRead).diagnostics[0].code, "LC_VM_INVALID_CAPTURE");
});

test("blocos em For e While preservam efeitos de algoritmo equivalente no executor leve", () => {
  const source = 'User Function Demo()\nLocal i\nLocal n := 0\nLocal b := {|x| ConOut(cValToChar(x)), x * 2}\nFor i := 1 To 2\nn += Eval(b, i)\nNext\nWhile n < 10\nn += Eval(b, 1)\nEndDo\nMsgInfo(cValToChar(n), "Resultado")\nReturn';
  const result = execute(source);
  success(result); assert.deepEqual(result.console, ["1", "2", "1", "1"]);
  const legacy = core.parse('User Function Demo()\nLocal i\nLocal n := 0\nFor i := 1 To 2\nConOut(cValToChar(i))\nn += i\nn += i\nNext\nFor i := 1 To 2\nConOut("1")\nn += 2\nNext\nMsgInfo(cValToChar(n), "Resultado")\nReturn');
  assert.deepEqual(result.events, legacy.events);
});
