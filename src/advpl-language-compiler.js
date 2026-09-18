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
    const program = bound?.program, diagnostics = [...(bound?.diagnostics || [])], constants = [], functions = Object.create(null);
    const declaredFunctions = new Set((program?.body || []).map(item => item.name.toUpperCase()));
    const constantIndex = value => { const found = constants.findIndex(item => Object.is(item, value)); if (found >= 0) return found; constants.push(value); return constants.length - 1; };
    if (!program || program.astVersion !== "0.1") {
      diagnostics.push(error("LC0301", "AST 0.1 vinculada é obrigatória.", program?.loc));
      return { bytecodeVersion: BYTECODE_VERSION, entry: null, constants, functions, diagnostics };
    }

    for (const declaration of program.body) {
      const instructions = [], slots = new Map(), symbolTable = bound.functions[declaration.name.toUpperCase()]?.symbols || {};
      let nextSlot = 0;
      for (const parameter of declaration.params) slots.set(parameter.toUpperCase(), nextSlot++);
      const allocateLocals = statements => {
        for (const statement of statements) {
          if (statement.type === "LocalDeclaration" && !slots.has(statement.name.toUpperCase())) slots.set(statement.name.toUpperCase(), nextSlot++);
          else if (statement.type === "IfStatement") { allocateLocals(statement.consequent); allocateLocals(statement.alternate); }
        }
      };
      allocateLocals(declaration.body);
      const emit = (op, arg, loc, extra = {}) => instructions.push({ op, ...(arg === undefined ? {} : { arg }), ...extra, loc });

      function expression(node) {
        if (!node) { emit("PUSH_CONST", constantIndex(null), declaration.loc); return; }
        if (node.type === "Literal") emit("PUSH_CONST", constantIndex(node.value), node.loc);
        else if (node.type === "Identifier") {
          const slot = slots.get(node.name.toUpperCase());
          if (slot === undefined) diagnostics.push(error("LC0302", `Identificador não vinculado: ${node.name}`, node.loc));
          else emit("LOAD_LOCAL", slot, node.loc);
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
          emit(declaredFunctions.has(name) ? "CALL_FUNCTION" : "CALL_RUNTIME", undefined, node.loc, { name, argc: node.arguments.length });
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
          } else diagnostics.push(error("LC0305", `Instrução não compilável: ${statement.type}`, statement.loc));
        }
      }
      compileStatements(declaration.body);
      if (!instructions.length || instructions.at(-1).op !== "RETURN") { emit("PUSH_CONST", constantIndex(null), declaration.loc); emit("RETURN", undefined, declaration.loc); }
      functions[declaration.name.toUpperCase()] = {
        name: declaration.name, visibility: declaration.visibility, parameterCount: declaration.params.length,
        localCount: nextSlot, slots: Object.fromEntries(slots), symbols: symbolTable, instructions
      };
    }
    return { bytecodeVersion: BYTECODE_VERSION, entry: program.body[0]?.name.toUpperCase() || null, constants, functions, diagnostics };
  }

  return Object.freeze({ BYTECODE_VERSION, compile });
});
