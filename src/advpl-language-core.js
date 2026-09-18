/*
 * ADVPL LANGUAGE CORE — CONTRATO AST EXPERIMENTAL 0.1
 * ---------------------------------------------------
 * Esta camada lê PPO textual e descreve sua estrutura; não executa código,
 * não produz telas e não substitui o executor leve. O recorte inicial existe
 * para estabilizar nós, posições e vinculação antes de desenhar bytecode/VM.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AdvPLLanguageCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const AST_VERSION = "0.1";
  const KEYWORDS = new Set(["USER", "STATIC", "FUNCTION", "LOCAL", "RETURN", "IF", "ELSE", "ENDIF", "NIL"]);

  function position(file, line, column, offset) { return { file, line, column, offset }; }
  function location(start, end) { return { start, end }; }
  function diagnostic(code, message, token) {
    return { code, severity: "error", message, line: token.start.line, column: token.start.column, origin: "language-core", file: token.start.file };
  }

  /** Tokeniza apenas a gramática comprovada pela fixture PPO sintética. */
  function tokenize(source, options = {}) {
    const text = String(source ?? ""), file = options.filename || "<ppo>";
    const tokens = [], diagnostics = [];
    let index = 0, line = 1, column = 1;
    const here = () => position(file, line, column, index);
    const advance = () => { const char = text[index++]; if (char === "\n") { line += 1; column = 1; } else column += 1; return char; };
    const emit = (type, value, raw, start) => tokens.push({ type, value, raw, start, end: here() });
    while (index < text.length) {
      const char = text[index], next = text[index + 1];
      if (char === " " || char === "\t" || char === "\r") { advance(); continue; }
      if (char === "\n") { const start = here(); advance(); emit("newline", "\n", "\n", start); continue; }
      if (char === "/" && next === "/") { while (index < text.length && text[index] !== "\n") advance(); continue; }
      if (char === "/" && next === "*") {
        const start = here(); advance(); advance();
        while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) advance();
        if (index >= text.length) diagnostics.push(diagnostic("LC0001", "Comentário de bloco não encerrado.", { start }));
        else { advance(); advance(); }
        continue;
      }
      if (char === '"' || char === "'") {
        const start = here(), quote = advance(); let value = "", closed = false;
        while (index < text.length) {
          const current = advance();
          if (current === quote) {
            if (text[index] === quote) { value += quote; advance(); continue; }
            closed = true; break;
          }
          value += current;
        }
        if (!closed) diagnostics.push(diagnostic("LC0002", "String não encerrada.", { start }));
        emit("string", value, text.slice(start.offset, index), start); continue;
      }
      if (/\d/.test(char)) {
        const start = here(); while (/\d/.test(text[index] || "")) advance();
        if (text[index] === "." && /\d/.test(text[index + 1] || "")) { advance(); while (/\d/.test(text[index] || "")) advance(); }
        const raw = text.slice(start.offset, index); emit("number", Number(raw), raw, start); continue;
      }
      if (/[A-Za-z_]/.test(char)) {
        const start = here(); while (/[A-Za-z0-9_]/.test(text[index] || "")) advance();
        const raw = text.slice(start.offset, index), upper = raw.toUpperCase();
        emit(KEYWORDS.has(upper) ? "keyword" : "identifier", upper === "NIL" ? null : raw, raw, start); continue;
      }
      const start = here(), pair = text.slice(index, index + 2);
      if ([":=", "+=", "==", "!=", "<=", ">="].includes(pair)) { advance(); advance(); emit("symbol", pair, pair, start); continue; }
      if ("()+-*/,<>".includes(char)) { advance(); emit("symbol", char, char, start); continue; }
      advance(); diagnostics.push(diagnostic("LC0003", `Caractere não suportado: ${char}`, { start }));
    }
    const end = here(); tokens.push({ type: "eof", value: null, raw: "", start: end, end });
    return { version: AST_VERSION, tokens, diagnostics };
  }

  function parse(source, options = {}) {
    const lexical = tokenize(source, options), tokens = lexical.tokens, diagnostics = [...lexical.diagnostics];
    let cursor = 0;
    const peek = (distance = 0) => tokens[Math.min(cursor + distance, tokens.length - 1)];
    const take = () => tokens[cursor++];
    const is = (value, token = peek()) => String(token.raw).toUpperCase() === String(value).toUpperCase();
    const skipLines = () => { while (peek().type === "newline") take(); };
    const expect = value => { const token = peek(); if (is(value, token)) return take(); diagnostics.push(diagnostic("LC0101", `Esperado ${value}; encontrado ${token.raw || "fim do arquivo"}.`, token)); return null; };
    const node = (type, start, end, fields = {}) => ({ type, ...fields, loc: location(start.start || start, end.end || end) });

    function primary() {
      const token = peek();
      if (["string", "number"].includes(token.type) || (token.type === "keyword" && token.value === null)) {
        take(); return node("Literal", token, token, { value: token.value, raw: token.raw });
      }
      if (token.type === "identifier") {
        take(); let expression = node("Identifier", token, token, { name: token.raw });
        if (is("(")) {
          take(); const args = [];
          while (!is(")") && peek().type !== "eof" && peek().type !== "newline") { args.push(expressionNode()); if (!is(",")) break; take(); }
          const close = expect(")") || token;
          expression = node("CallExpression", token, close, { callee: expression, arguments: args });
        }
        return expression;
      }
      if (is("(")) { const open = take(), expression = expressionNode(), close = expect(")") || open; return node("ParenthesizedExpression", open, close, { expression }); }
      diagnostics.push(diagnostic("LC0102", `Expressão esperada; encontrado ${token.raw || "fim do arquivo"}.`, token));
      take(); return node("InvalidExpression", token, token);
    }

    function unary() {
      if (is("+") || is("-")) {
        const operator = take(), argument = unary();
        return node("UnaryExpression", operator, argument.loc.end, { operator: operator.value, argument });
      }
      return primary();
    }

    const precedence = operator => ({ "==": 1, "!=": 1, "<": 1, "<=": 1, ">": 1, ">=": 1, "+": 2, "-": 2, "*": 3, "/": 3 }[operator] || 0);
    function binary(minimum = 1) {
      let left = unary();
      while (peek().type === "symbol" && precedence(peek().value) >= minimum) {
        const operator = take(), rank = precedence(operator.value), right = binary(rank + 1);
        left = node("BinaryExpression", left.loc.start, right.loc.end, { operator: operator.value, left, right });
      }
      return left;
    }
    function expressionNode() { return binary(); }

    function statement() {
      const start = peek();
      if (is("IF")) {
        take(); const test = expressionNode(); skipLines();
        const consequent = statementList(new Set(["ELSE", "ENDIF"]));
        let alternate = [];
        if (is("ELSE")) { take(); skipLines(); alternate = statementList(new Set(["ENDIF"])); }
        const close = expect("ENDIF") || consequent.at(-1) || test;
        return node("IfStatement", start, close, { test, consequent, alternate });
      }
      if (is("LOCAL")) {
        take(); const name = peek().type === "identifier" ? take() : null;
        if (!name) diagnostics.push(diagnostic("LC0103", "Nome de variável local esperado.", peek()));
        let init = null; if (is(":=")) { take(); init = expressionNode(); }
        const end = init?.loc.end || name?.end || start.end;
        return node("LocalDeclaration", start, end, { name: name?.raw || "<invalid>", init });
      }
      if (is("RETURN")) {
        take(); const argument = peek().type === "newline" || peek().type === "eof" ? null : expressionNode();
        return node("ReturnStatement", start, argument?.loc.end || start.end, { argument });
      }
      if (peek().type === "identifier" && [":=", "+="].includes(peek(1).value)) {
        const target = take(), operator = take(), value = expressionNode();
        return node("AssignmentStatement", target, value.loc.end, { name: target.raw, operator: operator.value, value });
      }
      const expression = expressionNode();
      return node("ExpressionStatement", expression.loc.start, expression.loc.end, { expression });
    }

    /** Lê um bloco até uma palavra de fechamento, sem consumir seu terminador. */
    function statementList(stoppers) {
      const statements = [];
      while (peek().type !== "eof" && !stoppers.has(String(peek().raw).toUpperCase()) && !is("USER") && !is("STATIC")) {
        statements.push(statement()); skipLines();
      }
      return statements;
    }

    function functionDeclaration() {
      const start = peek(), visibility = is("STATIC") ? (take(), "static") : (expect("USER"), "user");
      expect("FUNCTION"); const name = peek().type === "identifier" ? take() : null;
      if (!name) diagnostics.push(diagnostic("LC0104", "Nome de função esperado.", peek()));
      expect("("); const params = [];
      while (!is(")") && peek().type !== "eof") { if (peek().type === "identifier") params.push(take().raw); else { diagnostics.push(diagnostic("LC0105", "Parâmetro inválido.", peek())); take(); } if (!is(",")) break; take(); }
      const close = expect(")") || name || start; skipLines();
      const body = statementList(new Set());
      const end = body.at(-1)?.loc.end || close.end;
      return node("FunctionDeclaration", start, end, { name: name?.raw || "<invalid>", visibility, params, body });
    }

    skipLines(); const body = [];
    while (peek().type !== "eof") {
      if (is("USER") || is("STATIC")) body.push(functionDeclaration());
      else { diagnostics.push(diagnostic("LC0106", "Declaração de função esperada no nível superior.", peek())); while (peek().type !== "newline" && peek().type !== "eof") take(); }
      skipLines();
    }
    const start = tokens[0]?.start || position(options.filename || "<ppo>", 1, 1, 0), end = tokens.at(-1).end;
    return { type: "Program", astVersion: AST_VERSION, sourceType: "ppo", experimental: true, body, diagnostics, loc: location(start, end) };
  }

  /** Vincula declarações locais e parâmetros sem presumir APIs Protheus. */
  function bind(program) {
    const diagnostics = [], functions = Object.create(null);
    for (const declaration of program.body || []) {
      const key = declaration.name.toUpperCase();
      if (functions[key]) diagnostics.push({ code: "LC0201", severity: "error", message: `Função duplicada: ${declaration.name}`, line: declaration.loc.start.line, column: declaration.loc.start.column, origin: "language-core", file: declaration.loc.start.file });
      const symbols = Object.create(null);
      for (const parameter of declaration.params) symbols[parameter.toUpperCase()] = { kind: "parameter", name: parameter };
      const bindStatements = statements => {
        for (const statement of statements) {
          if (statement.type === "LocalDeclaration") {
            const localKey = statement.name.toUpperCase();
            if (symbols[localKey]) diagnostics.push({ code: "LC0202", severity: "error", message: `Símbolo local duplicado: ${statement.name}`, line: statement.loc.start.line, column: statement.loc.start.column, origin: "language-core", file: statement.loc.start.file });
            else symbols[localKey] = { kind: "local", name: statement.name };
          } else if (statement.type === "IfStatement") {
            bindStatements(statement.consequent); bindStatements(statement.alternate);
          }
        }
      };
      bindStatements(declaration.body);
      const validateAssignments = statements => {
        for (const statement of statements) {
          if (statement.type === "AssignmentStatement" && !symbols[statement.name.toUpperCase()]) {
            diagnostics.push({ code: "LC0203", severity: "error", message: `Atribuição a símbolo não vinculado: ${statement.name}`, line: statement.loc.start.line, column: statement.loc.start.column, origin: "language-core", file: statement.loc.start.file });
          } else if (statement.type === "IfStatement") {
            validateAssignments(statement.consequent); validateAssignments(statement.alternate);
          }
        }
      };
      validateAssignments(declaration.body);
      functions[key] = { kind: "function", name: declaration.name, visibility: declaration.visibility, params: [...declaration.params], symbols };
    }
    return { version: AST_VERSION, program, functions, diagnostics: [...(program.diagnostics || []), ...diagnostics] };
  }

  return Object.freeze({ AST_VERSION, tokenize, parse, bind });
});
