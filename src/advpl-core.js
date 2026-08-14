(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AdvPLCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "0.1.0";

  function stripComments(source) {
    return source.split(/\r?\n/).map(line => line.replace(/\/\/.*$/, "")).join("\n");
  }

  function statements(source) {
    const result = [];
    let current = "";
    for (const raw of stripComments(source).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      current += (current ? " " : "") + line.replace(/;\s*$/, "");
      if (!/;\s*$/.test(line)) { result.push(current.trim()); current = ""; }
    }
    if (current) result.push(current.trim());
    return result;
  }

  function unquote(value) {
    const text = String(value ?? "").trim();
    return ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) ? text.slice(1, -1) : text;
  }

  function numeric(value, fallback = 0) {
    const parsed = Number.parseFloat(String(value).replace(/^0+(?=\d)/, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clause(statement, name, stops) {
    const match = statement.match(new RegExp("\\b" + name + "\\s+(.+?)(?=\\s+\\b(?:" + stops.join("|") + ")\\b|$)", "i"));
    return match ? match[1].trim() : null;
  }

  function splitTopLevel(expression, separator) {
    const result = [];
    let current = "", depth = 0, quote = null;
    for (const char of expression) {
      if (quote) { current += char; if (char === quote) quote = null; }
      else if (char === '"' || char === "'") { quote = char; current += char; }
      else if (char === "(") { depth += 1; current += char; }
      else if (char === ")") { depth -= 1; current += char; }
      else if (char === separator && depth === 0) { result.push(current.trim()); current = ""; }
      else current += char;
    }
    result.push(current.trim());
    return result.filter(Boolean);
  }

  function hasOuterParentheses(expression) {
    const text = expression.trim();
    if (!text.startsWith("(") || !text.endsWith(")")) return false;
    let depth = 0, quote = null;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      if (quote) { if (char === quote) quote = null; continue; }
      if (char === '"' || char === "'") quote = char;
      else if (char === "(") depth += 1;
      else if (char === ")") depth -= 1;
      if (depth === 0 && index < text.length - 1) return false;
    }
    return depth === 0;
  }

  function evaluate(expression, variables = {}) {
    let token = String(expression ?? "").trim();
    while (hasOuterParentheses(token)) token = token.slice(1, -1).trim();
    const additions = splitTopLevel(token, "+");
    if (additions.length > 1) return additions.map(part => String(evaluate(part, variables))).join("");
    if (/^["']/.test(token)) return unquote(token);
    if (/^\.T\.$/i.test(token)) return true;
    if (/^\.F\.$/i.test(token)) return false;
    if (/^-?\d+(?:\.\d+)?$/.test(token)) return Number(token);
    let match = token.match(/^Space\s*\((.*)\)$/i);
    if (match) return " ".repeat(Math.max(0, Number(evaluate(match[1], variables)) || 0));
    match = token.match(/^AllTrim\s*\((.*)\)$/i);
    if (match) return String(evaluate(match[1], variables)).trim();
    return variables[token] ?? "";
  }

  function parseAction(action = "") {
    let list = action.trim();
    while (hasOuterParentheses(list)) list = list.slice(1, -1).trim();
    return splitTopLevel(list, ",").map(source => {
      const end = source.match(/^(\w+)\s*:\s*End\s*\(\s*\)$/i);
      if (end) return { type: "end", target: end[1], source };
      const message = source.match(/^MsgInfo\s*\((.*)\)$/i);
      if (message) return { type: "message", expression: message[1], source };
      return { type: "unknown", source };
    });
  }

  function parse(source) {
    const lines = statements(source);
    const variables = Object.create(null);
    for (const line of lines) {
      const local = line.match(/^Local\s+(\w+)(?:\s*:=\s*(.+))?$/i);
      if (local) variables[local[1]] = local[2] == null ? null : evaluate(local[2], variables);
    }
    let dialog = null;
    const controls = [];
    for (const line of lines) {
      let match = line.match(/^DEFINE\s+MSDIALOG\s+(\w+)/i);
      if (match) {
        const from = clause(line, "FROM", ["TO", "TITLE", "PIXEL", "STYLE"]);
        const to = clause(line, "TO", ["FROM", "TITLE", "PIXEL", "STYLE"]);
        const fromPair = from ? from.split(",") : [0, 0];
        const toPair = to ? to.split(",") : [240, 480];
        dialog = { variable: match[1], title: unquote(clause(line, "TITLE", ["FROM", "TO", "PIXEL", "STYLE"]) || "MSDialog"), top: numeric(fromPair[0]), left: numeric(fromPair[1]), bottom: numeric(toPair[0], 240), right: numeric(toPair[1], 480), pixel: /\bPIXELS?\b/i.test(line), centered: false };
        continue;
      }
      match = line.match(/^ACTIVATE\s+MSDIALOG\s+(\w+)/i);
      if (match && dialog) { dialog.centered = /\bCENTERED\b/i.test(line); continue; }
      match = line.match(/^@\s*([\d.]+)\s*,\s*([\d.]+)\s+(SAY|GET|MSGET|BUTTON|CHECKBOX)\b\s*(.*)$/i);
      if (!match) continue;
      const [, row, col, rawType, tail] = match;
      const type = rawType.toUpperCase();
      const stops = ["SIZE", "OF", "PIXEL", "PROMPT", "VAR", "ACTION", "VALID", "WHEN", "PICTURE"];
      const size = clause(tail, "SIZE", stops.filter(item => item !== "SIZE"));
      const sizePair = size ? size.split(",") : [type === "BUTTON" ? 70 : 100, type === "BUTTON" ? 22 : 12];
      const firstWord = tail.match(/^(\w+)\b/)?.[1];
      const quoted = tail.match(/^["']([^"']*)["']/)?.[1];
      const explicitVar = clause(tail, "VAR", stops.filter(item => item !== "VAR"))?.match(/^\w+/)?.[0];
      controls.push({ type: type === "MSGET" ? "GET" : type, sourceType: type, row: numeric(row), col: numeric(col), width: numeric(sizePair[0], 100), height: numeric(sizePair[1], 12), objectVariable: firstWord && !quoted ? firstWord : null, text: quoted ?? unquote(clause(tail, "PROMPT", stops.filter(item => item !== "PROMPT")) || ""), boundVar: explicitVar ?? (type === "MSGET" ? firstWord : null), action: clause(tail, "ACTION", stops.filter(item => item !== "ACTION")) });
    }
    if (!dialog) throw new Error("Nenhum comando DEFINE MSDIALOG foi encontrado.");
    return { version: VERSION, dialog, controls, variables };
  }

  return Object.freeze({ VERSION, parse, evaluate, parseAction, statements, splitTopLevel });
});
