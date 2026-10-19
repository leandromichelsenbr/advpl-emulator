/* Compila a AST vinculada 0.1 para uma ISA própria baseada em pilha. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AdvPLLanguageCompiler = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const BYTECODE_VERSION = "0.1";
  const binaryOps = Object.freeze({ "+": "ADD", "-": "SUB", "*": "MUL", "/": "DIV", "==": "EQ", "!=": "NE", "<": "LT", "<=": "LE", ">": "GT", ">=": "GE" });
  const error = (code, message, loc) => ({ code, severity: "error", message, line: loc?.start?.line || 1, column: loc?.start?.column || 1, origin: "language-compiler", file: loc?.start?.file || "<ppo>" });

  function compile(bound) {
    const program = bound?.program, diagnostics = [...(bound?.diagnostics || [])], constants = [], functions = Object.create(null), blocks = Object.create(null);
    let nextBlock = 0;
    const declaredFunctions = new Set((program?.body || []).map(item => item.name.toUpperCase()));
    const constantIndex = value => { const found = constants.findIndex(item => Object.is(item, value)); if (found >= 0) return found; constants.push(value); return constants.length - 1; };
    if (!program || program.astVersion !== "0.1") {
      diagnostics.push(error("LC0301", "AST 0.1 vinculada é obrigatória.", program?.loc));
      return { bytecodeVersion: BYTECODE_VERSION, entry: null, constants, functions, diagnostics };
    }

    function compileScope(declaration, parent = null) {
      const instructions = [], slots = new Map(), captures = [], captureSlots = new Map(), forTemps = new WeakMap(), symbolTable = bound.functions[declaration.name.toUpperCase()]?.symbols || {};
      let nextSlot = 0;
      for (const parameter of declaration.params) slots.set(parameter.toUpperCase(), nextSlot++);
      const allocateLocals = statements => {
        for (const statement of statements) {
          if (statement.type === "LocalDeclaration" && !slots.has(statement.name.toUpperCase())) slots.set(statement.name.toUpperCase(), nextSlot++);
          else if (statement.type === "IfStatement") { allocateLocals(statement.consequent); allocateLocals(statement.alternate); }
          else if (statement.type === "WhileStatement") allocateLocals(statement.body);
          else if (statement.type === "ForStatement") {
            forTemps.set(statement, { limit: nextSlot++, step: nextSlot++ });
            allocateLocals(statement.body);
          }
        }
      };
      allocateLocals(declaration.body);
      const emit = (op, arg, loc, extra = {}) => instructions.push({ op, ...(arg === undefined ? {} : { arg }), ...extra, loc });
      // Capturas descrevem células do escopo pai, nunca uma cópia do valor atual.
      const resolve = name => {
        const key = name.toUpperCase();
        if (slots.has(key)) return { kind: "local", index: slots.get(key) };
        if (captureSlots.has(key)) return { kind: "capture", index: captureSlots.get(key) };
        const source = parent?.resolve(name);
        if (!source) return null;
        const index = captures.length;
        captures.push(source); captureSlots.set(key, index);
        return { kind: "capture", index };
      };
      const load = (binding, loc) => emit(binding.kind === "local" ? "LOAD_LOCAL" : "LOAD_CAPTURE", binding.index, loc);
      const store = (binding, loc) => emit(binding.kind === "local" ? "STORE_LOCAL" : "STORE_CAPTURE", binding.index, loc);

      function expression(node) {
        if (!node) { emit("PUSH_CONST", constantIndex(null), declaration.loc); return; }
        if (node.type === "Literal") emit("PUSH_CONST", constantIndex(node.value), node.loc);
        else if (node.type === "Identifier") {
          const binding = resolve(node.name);
          if (!binding) diagnostics.push(error("LC0302", `Identificador não vinculado: ${node.name}`, node.loc));
          else load(binding, node.loc);
        } else if (node.type === "AssignmentExpression") {
          const binding = resolve(node.name);
          if (!binding) diagnostics.push(error("LC0302", `Identificador não vinculado: ${node.name}`, node.loc));
          else {
            if (node.operator === "+=") load(binding, node.loc);
            expression(node.value);
            if (node.operator === "+=") emit("ADD", undefined, node.loc);
            emit("DUP", undefined, node.loc); store(binding, node.loc);
          }
        } else if (node.type === "CodeBlockExpression") {
          const name = `$BLOCK${nextBlock++}`;
          const body = node.expressions.map((item, index) => index === node.expressions.length - 1
            ? { type: "ReturnStatement", argument: item, loc: item.loc }
            : { type: "ExpressionStatement", expression: item, loc: item.loc });
          blocks[name] = compileScope({ name, params: node.params, body, visibility: "block", loc: node.loc }, { resolve });
          emit("MAKE_BLOCK", name, node.loc);
        } else if (node.type === "ParenthesizedExpression") expression(node.expression);
        else if (node.type === "UnaryExpression") {
          expression(node.argument);
          if (node.operator === "-") emit("NEG", undefined, node.loc);
          else if (node.operator !== "+") diagnostics.push(error("LC0303", `Operador não compilável: ${node.operator}`, node.loc));
        }
        else if (node.type === "BinaryExpression") {
          expression(node.left); expression(node.right);
          const op = binaryOps[node.operator];
          if (!op) diagnostics.push(error("LC0303", `Operador não compilável: ${node.operator}`, node.loc)); else emit(op, undefined, node.loc);
        } else if (node.type === "CallExpression" && node.callee.type === "Identifier") {
          for (const argument of node.arguments) expression(argument);
          const name = node.callee.name.toUpperCase();
          if (name === "EVAL" && !declaredFunctions.has(name)) {
            if (!node.arguments.length) diagnostics.push(error("LC0306", "Eval exige um bloco de código.", node.loc));
            else emit("CALL_BLOCK", undefined, node.loc, { argc: node.arguments.length - 1 });
          } else emit(declaredFunctions.has(name) ? "CALL_FUNCTION" : "CALL_RUNTIME", undefined, node.loc, { name, argc: node.arguments.length });
        } else diagnostics.push(error("LC0304", `Nó não compilável: ${node.type}`, node.loc));
      }

      function compileStatements(statements) {
        for (const statement of statements) {
          if (statement.type === "LocalDeclaration") {
            expression(statement.init); emit("STORE_LOCAL", slots.get(statement.name.toUpperCase()), statement.loc);
          } else if (statement.type === "AssignmentStatement") {
            const slot = slots.get(statement.name.toUpperCase());
            if (slot === undefined) diagnostics.push(error("LC0302", `Identificador não vinculado: ${statement.name}`, statement.loc));
            else {
              if (statement.operator === "+=") emit("LOAD_LOCAL", slot, statement.loc);
              expression(statement.value);
              if (statement.operator === "+=") emit("ADD", undefined, statement.loc);
              emit("STORE_LOCAL", slot, statement.loc);
            }
          } else if (statement.type === "ExpressionStatement") {
            expression(statement.expression); emit("POP", undefined, statement.loc);
          } else if (statement.type === "ReturnStatement") {
            expression(statement.argument); emit("RETURN", undefined, statement.loc);
          } else if (statement.type === "IfStatement") {
            expression(statement.test);
            const conditionJump = instructions.length; emit("JUMP_IF_FALSE", null, statement.test.loc);
            compileStatements(statement.consequent);
            if (statement.alternate.length) {
              const endJump = instructions.length; emit("JUMP", null, statement.loc);
              instructions[conditionJump].arg = instructions.length;
              compileStatements(statement.alternate);
              instructions[endJump].arg = instructions.length;
            } else instructions[conditionJump].arg = instructions.length;
          } else if (statement.type === "WhileStatement") {
            // O salto retorna ao início da expressão, reavaliando também chamadas.
            const loopStart = instructions.length;
            expression(statement.test);
            const exitJump = instructions.length; emit("JUMP_IF_FALSE", null, statement.test.loc);
            compileStatements(statement.body);
            emit("JUMP", loopStart, statement.loc);
            instructions[exitJump].arg = instructions.length;
          } else if (statement.type === "ForStatement") {
            const variableSlot = slots.get(statement.variable.toUpperCase()), temps = forTemps.get(statement);
            if (variableSlot === undefined) { diagnostics.push(error("LC0302", `Identificador não vinculado: ${statement.variable}`, statement.loc)); continue; }
            expression(statement.initial); emit("STORE_LOCAL", variableSlot, statement.loc);
            expression(statement.limit); emit("STORE_LOCAL", temps.limit, statement.loc);
            expression(statement.step); emit("STORE_LOCAL", temps.step, statement.loc);

            const loopStart = instructions.length;
            emit("LOAD_LOCAL", temps.step, statement.step.loc);
            emit("PUSH_CONST", constantIndex(0), statement.step.loc);
            emit("GE", undefined, statement.step.loc);
            const negativeBranch = instructions.length; emit("JUMP_IF_FALSE", null, statement.step.loc);

            emit("LOAD_LOCAL", variableSlot, statement.loc);
            emit("LOAD_LOCAL", temps.limit, statement.limit.loc);
            emit("LE", undefined, statement.loc);
            const conditionReady = instructions.length; emit("JUMP", null, statement.loc);

            instructions[negativeBranch].arg = instructions.length;
            emit("LOAD_LOCAL", variableSlot, statement.loc);
            emit("LOAD_LOCAL", temps.limit, statement.limit.loc);
            emit("GE", undefined, statement.loc);
            instructions[conditionReady].arg = instructions.length;
            const exitJump = instructions.length; emit("JUMP_IF_FALSE", null, statement.loc);

            compileStatements(statement.body);
            emit("LOAD_LOCAL", variableSlot, statement.loc);
            emit("LOAD_LOCAL", temps.step, statement.step.loc);
            emit("ADD", undefined, statement.loc);
            emit("STORE_LOCAL", variableSlot, statement.loc);
            emit("JUMP", loopStart, statement.loc);
            instructions[exitJump].arg = instructions.length;
          } else diagnostics.push(error("LC0305", `Instrução não compilável: ${statement.type}`, statement.loc));
        }
      }
      compileStatements(declaration.body);
      if (!instructions.length || instructions.at(-1).op !== "RETURN") { emit("PUSH_CONST", constantIndex(null), declaration.loc); emit("RETURN", undefined, declaration.loc); }
      return {
        name: declaration.name, visibility: declaration.visibility, parameterCount: declaration.params.length,
        localCount: nextSlot, slots: Object.fromEntries(slots), captures, symbols: symbolTable, instructions
      };
    }
    for (const declaration of program.body) functions[declaration.name.toUpperCase()] = compileScope(declaration);
    return { bytecodeVersion: BYTECODE_VERSION, entry: program.body[0]?.name.toUpperCase() || null, constants, functions, blocks, diagnostics };
  }

  return Object.freeze({ BYTECODE_VERSION, compile });
});
