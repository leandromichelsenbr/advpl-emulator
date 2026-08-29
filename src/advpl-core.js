(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AdvPLCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // VERSION identifica o contrato público consumido por integrações existentes.
  // A versão do pacote evolui separadamente enquanto a API 0.1 permanecer compatível.
  const VERSION = "0.1.0";
  const API_VERSION = "0.1";
  const PACKAGE_VERSION = "0.3.0";

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

  function splitArguments(expression) {
    const result = [];
    let current = "", depth = 0, quote = null, blockDepth = 0;
    for (let index = 0; index < expression.length; index += 1) {
      const char = expression[index];
      if (quote) {
        current += char;
        if (char === quote) quote = null;
      } else if (char === '"' || char === "'") {
        quote = char; current += char;
      } else if (char === "{") {
        blockDepth += 1; current += char;
      } else if (char === "}") {
        blockDepth -= 1; current += char;
      } else if (char === "(") {
        depth += 1; current += char;
      } else if (char === ")") {
        depth -= 1; current += char;
      } else if (char === "," && depth === 0 && blockDepth === 0) {
        result.push(current.trim()); current = "";
      } else current += char;
    }
    result.push(current.trim());
    return result;
  }

  function splitBinary(expression, operators) {
    let depth = 0, quote = null;
    for (let index = expression.length - 1; index >= 0; index -= 1) {
      const char = expression[index];
      if (quote) { if (char === quote) quote = null; continue; }
      if (char === '"' || char === "'") { quote = char; continue; }
      if (char === ")") { depth += 1; continue; }
      if (char === "(") { depth -= 1; continue; }
      if (depth !== 0) continue;
      for (const operator of operators) {
        const start = index - operator.length + 1;
        if (start >= 0 && expression.slice(start, index + 1) === operator) {
          return [expression.slice(0, start).trim(), operator, expression.slice(index + 1).trim()];
        }
      }
    }
    return null;
  }

  function codeBlockBody(value = "") {
    const match = value.trim().match(/^\{\s*\|[^|]*\|([\s\S]*)\}$/);
    return match ? match[1].trim() : null;
  }

  function parseArray(value) {
    const text = String(value ?? "").trim();
    if (!text.startsWith("{") || !text.endsWith("}")) return null;
    return splitArguments(text.slice(1, -1)).map(item => {
      const nested = parseArray(item);
      if (nested) return nested;
      if (/^\.T\.$/i.test(item)) return true;
      if (/^\.F\.$/i.test(item)) return false;
      if (/^-?\d+(?:\.\d+)?$/.test(item)) return Number(item);
      return unquote(item);
    });
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

  function evaluate(expression, variables = {}, callFunction = null) {
    let token = String(expression ?? "").trim();
    while (hasOuterParentheses(token)) token = token.slice(1, -1).trim();
    let binary = splitBinary(token, ["==", "!=", "<=", ">=", "<", ">"]);
    if (binary) {
      const [leftSource, operator, rightSource] = binary;
      const left = evaluate(leftSource, variables, callFunction), right = evaluate(rightSource, variables, callFunction);
      if (operator === "==") return left === right;
      if (operator === "!=") return left !== right;
      if (operator === "<") return left < right;
      if (operator === ">") return left > right;
      if (operator === "<=") return left <= right;
      return left >= right;
    }
    const additions = splitTopLevel(token, "+");
    if (additions.length > 1) {
      const values = additions.map(part => evaluate(part, variables, callFunction));
      return values.every(value => typeof value === "number") ? values.reduce((sum, value) => sum + value, 0) : values.map(String).join("");
    }
    binary = splitBinary(token, ["-"]);
    if (binary && binary[0]) return Number(evaluate(binary[0], variables, callFunction)) - Number(evaluate(binary[2], variables, callFunction));
    if (/^["']/.test(token)) return unquote(token);
    if (/^\.T\.$/i.test(token)) return true;
    if (/^\.F\.$/i.test(token)) return false;
    if (/^-?\d+(?:\.\d+)?$/.test(token)) return Number(token);
    const array = parseArray(token);
    if (array) return array;
    let match = token.match(/^Space\s*\((.*)\)$/i);
    if (match) return " ".repeat(Math.max(0, Number(evaluate(match[1], variables, callFunction)) || 0));
    match = token.match(/^AllTrim\s*\((.*)\)$/i);
    if (match) return String(evaluate(match[1], variables, callFunction)).trim();
    match = token.match(/^Abs\s*\((.*)\)$/i);
    if (match) return Math.abs(Number(evaluate(match[1], variables, callFunction)) || 0);
    match = token.match(/^cValToChar\s*\((.*)\)$/i);
    if (match) return String(evaluate(match[1], variables, callFunction));
    match = token.match(/^Chr\s*\((.*)\)$/i);
    if (match) return String.fromCharCode(Number(evaluate(match[1], variables, callFunction)) || 0);
    match = token.match(/^Len\s*\((.*)\)$/i);
    if (match) return evaluate(match[1], variables, callFunction)?.length ?? 0;
    match = token.match(/^AClone\s*\((.*)\)$/i);
    if (match) {
      const clone = value => Array.isArray(value) ? value.map(clone) : value;
      return clone(evaluate(match[1], variables, callFunction));
    }
    match = token.match(/^(?:U_)?(\w+)\s*\((.*)\)$/i);
    if (match && callFunction) return callFunction(match[1], splitArguments(match[2]).map(argument => evaluate(argument, variables, callFunction)));
    match = token.match(/^(\w+)((?:\s*\[\s*[^\]]+\s*\])*)$/i);
    if (match) {
      const key = Object.keys(variables).find(name => name.toLowerCase() === match[1].toLowerCase());
      let value = key ? variables[key] : "";
      for (const index of (match[2] || "").matchAll(/\[\s*([^\]]+)\s*\]/g)) value = value?.[Number(evaluate(index[1], variables, callFunction)) - 1];
      return value ?? "";
    }
    return variables[token] ?? "";
  }

  function assignLocalDeclarations(declaration, variables) {
    for (const item of splitArguments(declaration)) {
      const local = item.match(/^(\w+)(?:\s*:=\s*(.+))?$/i);
      if (local) variables[local[1]] = local[2] == null ? null : evaluate(local[2], variables);
    }
  }

  const SIGNATURES = Object.freeze({
    // Assinaturas de compatibilidade do emulador. Não substituem o compilador TDS.
    msginfo: { minimum: 2, code: "W0008" }
  });

  function diagnose(source) {
    const diagnostics = [];
    String(source ?? "").split(/\r?\n/).forEach((line, lineIndex) => {
      for (const match of line.matchAll(/\b(MsgInfo)\s*\(([^)]*)\)/gi)) {
        const signature = SIGNATURES[match[1].toLowerCase()];
        const received = splitArguments(match[2]).filter(argument => argument !== "").length;
        if (signature && received < signature.minimum) diagnostics.push({
          code: signature.code, severity: "warning",
          message: `Too few parameters calling ${match[1]}`,
          line: lineIndex + 1, column: match.index + 1,
          functionName: match[1], expectedMinimum: signature.minimum, received,
          origin: "emulator-signatures"
        });
      }
    });
    return diagnostics;
  }

  function parseMessageProgram(source) {
    const lines = statements(source);
    const globals = Object.create(null);
    for (const define of String(source).matchAll(/^\s*#\s*DEFINE\s+(\w+)\s+(.+)$/gim)) globals[define[1]] = evaluate(define[2].trim(), globals);
    const messages = [];
    const consoleOutput = [];
    const events = [];
    const functions = Object.create(null);
    let current = { name: "__main__", visibility: "implicit", parameters: [], lines: [] };
    functions.__main__ = current;
    for (const line of lines) {
      const header = line.match(/^(User|Static)\s+Function\s+(\w+)\s*\(([^)]*)\)/i);
      if (header) {
        current = { name: header[2], visibility: header[1].toLowerCase(), parameters: splitArguments(header[3]).filter(Boolean), lines: [] };
        functions[header[2].toLowerCase()] = current;
      } else current.lines.push(line);
    }
    const entry = Object.values(functions).find(item => item.visibility === "user") || functions.__main__;
    const findFunction = name => functions[String(name).replace(/^U_/i, "").toLowerCase()];
    let callFunction, callDepth = 0;
    const executeFunction = (definition, args = []) => {
      const variables = Object.assign(Object.create(null), globals);
      definition.parameters.forEach((name, index) => { variables[name] = args[index] ?? null; });
      const active = [];
      const isActive = () => active.every(frame => frame.active);
      let returned = false, returnValue = null;
      const value = expression => evaluate(expression, variables, callFunction);
      const executeLine = line => {
        const local = line.match(/^Local\s+(.+)$/i);
        if (local) {
          for (const item of splitArguments(local[1])) {
            const declaration = item.match(/^(\w+)(?:\s*:=\s*(.+))?$/i);
            if (declaration) variables[declaration[1]] = declaration[2] == null ? null : value(declaration[2]);
          }
          return true;
        }
        const parameters = line.match(/^Param(?:eter)?s?\s+(.+)$/i);
        if (parameters) { splitArguments(parameters[1]).forEach((name, index) => { variables[name] = args[index] ?? null; }); return true; }
        const append = line.match(/^(\w+)\s*\+=\s*(.+)$/i);
        if (append) { variables[append[1]] = String(variables[append[1]] ?? "") + String(value(append[2])); return true; }
        const assignment = line.match(/^(\w+)\s*:=\s*(.+)$/i);
        if (assignment) { variables[assignment[1]] = value(assignment[2]); return true; }
        const copy = line.match(/^ACopy\s*\(\s*(\w+)\s*,\s*(\w+)(?:\s*,[^)]*)?\)$/i);
        if (copy) { variables[copy[2]] = Array.isArray(variables[copy[1]]) ? variables[copy[1]].slice() : []; return true; }
        const call = line.match(/^(Return\s+)?(Msg(?:Info|Stop|Alert)|Alert)\s*\((.*)\)$/i);
        if (call) {
          const messageArgs = splitArguments(call[3]);
          const kind = /^Alert$/i.test(call[2]) ? "stop" : call[2].replace(/^Msg/i, "").toLowerCase();
          const message = { kind, text: String(value(messageArgs[0])), title: messageArgs[1] ? String(value(messageArgs[1])) : "TOTVS" };
          messages.push(message);
          events.push({ type: "message", ...message });
          if (call[1]) returned = true;
          return true;
        }
        const consoleCall = line.match(/^ConOut\s*\((.*)\)$/i);
        if (consoleCall) {
          const text = splitArguments(consoleCall[1]).map(argument => String(value(argument))).join(" ");
          consoleOutput.push(text);
          events.push({ type: "console", text });
          return true;
        }
        const functionCall = line.match(/^(?:U_)?(\w+)\s*\((.*)\)$/i);
        if (functionCall && findFunction(functionCall[1])) { callFunction(functionCall[1], splitArguments(functionCall[2]).map(value)); return true; }
        const returnMatch = line.match(/^Return(?:\s+(.+))?$/i);
        if (returnMatch) { returnValue = returnMatch[1] == null ? null : value(returnMatch[1]); returned = true; return true; }
        return false;
      };
      for (let lineIndex = 0; lineIndex < definition.lines.length && !returned; lineIndex += 1) {
        const line = definition.lines[lineIndex];
        const conditional = line.match(/^If\s+(.+)$/i);
        if (conditional) {
          const parentActive = isActive();
          active.push({ parentActive, condition: parentActive && Boolean(value(conditional[1])), active: false });
          active.at(-1).active = active.at(-1).condition;
          continue;
        }
        if (/^Else$/i.test(line)) {
          const frame = active.at(-1);
          if (frame) frame.active = frame.parentActive && !frame.condition;
          continue;
        }
        if (/^EndIf$/i.test(line)) { active.pop(); continue; }
        if (!isActive()) continue;
        const loop = line.match(/^For\s+(\w+)\s*:=\s*(.+?)\s+To\s+(.+?)(?:\s+Step\s+(.+))?$/i);
        if (loop) {
          let nextIndex = lineIndex + 1, depth = 1;
          for (; nextIndex < definition.lines.length; nextIndex += 1) {
            if (/^For\b/i.test(definition.lines[nextIndex])) depth += 1;
            if (/^Next\b/i.test(definition.lines[nextIndex]) && --depth === 0) break;
          }
          const start = Number(value(loop[2])), end = Number(value(loop[3]));
          const step = loop[4] ? Number(value(loop[4])) : 1;
          for (let loopValue = start; step >= 0 ? loopValue <= end : loopValue >= end; loopValue += step) {
            variables[loop[1]] = loopValue;
            for (let bodyIndex = lineIndex + 1; bodyIndex < nextIndex && !returned; bodyIndex += 1) executeLine(definition.lines[bodyIndex]);
          }
          lineIndex = nextIndex;
          continue;
        }
        executeLine(line);
      }
      return { value: returnValue, variables };
    };
    callFunction = (name, args) => {
      const definition = findFunction(name);
      if (!definition || callDepth >= 64) return "";
      callDepth += 1;
      try { return executeFunction(definition, args).value; }
      finally { callDepth -= 1; }
    };
    const execution = executeFunction(entry);
    if (!events.length) return null;
    const common = { version: VERSION, events, console: consoleOutput, variables: execution.variables, controls: [], diagnostics: diagnose(source) };
    if (messages.length) return { kind: "message", message: messages[0], messages, ...common };
    return { kind: "console", ...common };
  }

  function parseAction(action = "") {
    let list = action.trim();
    while (hasOuterParentheses(list)) list = list.slice(1, -1).trim();
    return splitTopLevel(list, ",").map(source => {
      const end = source.match(/^(\w+)\s*:\s*End\s*\(\s*\)$/i);
      if (end) return { type: "end", target: end[1], source };
      const message = source.match(/^(Msg(?:Info|Stop|Alert)|Alert)\s*\((.*)\)$/i);
      if (message) {
        const args = splitArguments(message[2]);
        const kind = /^Alert$/i.test(message[1]) ? "stop" : message[1].replace(/^Msg/i, "").toLowerCase();
        return { type: "message", kind, expression: args[0] || '""', titleExpression: args[1] || null, source };
      }
      const consoleCall = source.match(/^ConOut\s*\((.*)\)$/i);
      if (consoleCall) return { type: "console", expression: consoleCall[1], source };
      if (/^\.T\.$/i.test(source)) return { type: "return", value: true, source };
      if (/^\.F\.$/i.test(source)) return { type: "return", value: false, source };
      return { type: "unknown", source };
    });
  }

  function parseReport(source) {
    const engineMatch = source.match(/\b(FWMSPrinter|TMSPrinter)\s*\(\s*\)\s*:\s*New/i);
    if (!engineMatch) return null;
    const engine = /^TMSPrinter$/i.test(engineMatch[1]) ? "TMSPrinter" : "FWMSPrinter";
    const cleanSource = source.replace(/\/\*[\s\S]*?\*\//g, "");
    const question = source.match(/MsgYesNo\s*\(\s*(["'][\s\S]*?["'])\s*,\s*(["'][\s\S]*?["'])\s*\)/i);
    const title = source.match(/cTexto\s*:=\s*(["']Rela[çc][aã]o[^"']*["'])/i);
    const documentName = cleanSource.match(/\b(?:FWMSPrinter|TMSPrinter)\s*\(\s*\)\s*:\s*New\s*\(\s*(["'][^"']+["'])/i);
    const resolution = source.match(/:\s*SetResolution\s*\(\s*(\d+)/i);
    const margins = source.match(/:\s*SetMargin\s*\(\s*([^)]*)\)/i);
    const marginValues = margins ? splitArguments(margins[1]).map(value => numeric(value)) : [60, 60, 60, 60];
    const labels = [...source.matchAll(/:\s*SayAlign\s*\([^\r\n]*?,\s*(["'][^"']+["'])\s*,\s*oFontDetN/gi)].map(match => unquote(match[1]));
    const sayElements = [...cleanSource.matchAll(/\w+\s*:\s*Say\s*\(([^\r\n]*)\)/gi)].map(match => {
      const args = splitArguments(match[1]);
      return { type: "text", row: numeric(args[0]), col: numeric(args[1]), text: unquote(args[2]), font: args[3] || null, width: numeric(args[4]), color: /CLR_HRED/i.test(args[5] || "") ? "#ff0000" : "#000000" };
    });
    const barcodeElements = [...cleanSource.matchAll(/\w+\s*:\s*Ean13\s*\(\s*([^,]+),\s*([^,]+),\s*(["'][^"']*["']),\s*([^,]+),\s*([^\)]+)/gi)].map(match => ({
      type: "ean13", row: numeric(match[1]), col: numeric(match[2]), code: unquote(match[3]), width: numeric(match[4]), height: numeric(match[5])
    }));
    const qrElements = [...cleanSource.matchAll(/\w+\s*:\s*QRCode\s*\(\s*([^,]+),\s*([^,]+),\s*(["'][^"']*["']),\s*([^\)]+)/gi)].map(match => ({
      type: "qrcode", row: numeric(match[1]), col: numeric(match[2]), content: unquote(match[3]), size: numeric(match[4], 100)
    }));
    const lineElements = [...cleanSource.matchAll(/\w+\s*:\s*Line\s*\(([^\r\n]*)\)/gi)].map(match => {
      const args = splitArguments(match[1]); return { type: "line", row: numeric(args[0]), col: numeric(args[1]), bottom: numeric(args[2]), right: numeric(args[3]) };
    });
    const boxElements = [...cleanSource.matchAll(/\w+\s*:\s*Box\s*\(([^\r\n]*)\)/gi)].map(match => {
      const args = splitArguments(match[1]); return { type: "box", row: numeric(args[0]), col: numeric(args[1]), bottom: numeric(args[2]), right: numeric(args[3]) };
    });
    const brushColors = Object.create(null);
    for (const match of cleanSource.matchAll(/(\w+)\s*:=\s*TBrush\s*\(\s*\)\s*:\s*New\s*\([^,]*,\s*(\w+)/gi)) brushColors[match[1].toLowerCase()] = /YELLOW/i.test(match[2]) ? "#ffff00" : "#000000";
    const fillElements = [...cleanSource.matchAll(/\w+\s*:\s*FillRect\s*\(\s*(\{[^}]+\})\s*,\s*(\w+)\s*\)/gi)].map(match => {
      const rect = parseArray(match[1]); return { type: "fill", row: numeric(rect?.[0]), col: numeric(rect?.[1]), bottom: numeric(rect?.[2]), right: numeric(rect?.[3]), color: brushColors[match[2].toLowerCase()] || "#000000" };
    });
    const bitmapElements = [...cleanSource.matchAll(/\w+\s*:\s*SayBitmap\s*\(([^\r\n]*)\)/gi)].map(match => {
      const args = splitArguments(match[1]); return { type: "bitmap", row: numeric(args[0]), col: numeric(args[1]), path: unquote(args[2]), width: numeric(args[3]), height: numeric(args[4]) };
    });
    const layoutElements = [...sayElements, ...barcodeElements, ...qrElements, ...lineElements, ...boxElements, ...fillElements, ...bitmapElements];
    const reportTitle = unquote(title?.[1] || documentName?.[1] || "Relatório");
    const isProductGroupReport = /Rela[çc][aã]o\s+de\s+Grupos\s+de\s+Produtos/i.test(reportTitle) || (/BM_GRUPO/i.test(source) && /BM_DESC/i.test(source));
    const referenceRows = isProductGroupReport ? [
      ["0001", "Plastico"], ["0002", "Borracha"], ["0003", "Aluminio"], ["0004", "Eletronicos"],
      ["0005", "Pneumaticos"], ["0006", "Produtos Quimicos"], ["0007", "Produto de Venda"]
    ] : [];
    const program = {
      kind: "report", version: VERSION,
      confirmation: question ? { message: unquote(question[1]), title: unquote(question[2]) } : null,
      setup: { enabled: /:\s*Setup\s*\(\s*\)/i.test(cleanSource), title: engine === "TMSPrinter" ? "Configuração de Impressora" : "TOTVSPrinter", variant: engine === "TMSPrinter" ? "legacy" : "framework" },
      report: {
        engine, format: "PDF", paper: /SetPaperSize\s*\(\s*DMPAPER_A4/i.test(source) || engine === "TMSPrinter" ? "A4" : "custom",
        orientation: /:\s*SetLandscape\s*\(/i.test(source) ? "landscape" : "portrait",
        orientationSource: /:\s*SetLandscape\s*\(/i.test(source) ? "SetLandscape" : /:\s*SetPortrait\s*\(/i.test(source) ? "SetPortrait" : "default",
        resolution: numeric(resolution?.[1], 72), margins: marginValues,
        title: reportTitle, headers: labels.length ? labels : [],
        rows: referenceRows,
        footer: { date: "21/08/2026", time: "23:34:05", functionName: "TESTE", user: "Administrador", page: 1 },
        sourceDataRequired: isProductGroupReport,
        templateId: isProductGroupReport ? "product-groups-reference" : null,
        layout: layoutElements.length ? "absolute" : "table", elements: layoutElements,
        coordinateSystem: engine === "TMSPrinter" ? { scale: 0.24, offsetX: 8.4, offsetY: 14.16 } : { scale: 1, offsetX: 0, offsetY: 0 }
      },
      controls: [], variables: Object.create(null)
    };
    const reportLines = statements(source);
    const runtimeVariables = Object.create(null);
    for (const line of reportLines) {
      const local = line.match(/^Local\s+(.+)$/i);
      if (local) assignLocalDeclarations(local[1], runtimeVariables);
    }
    const hasMixedRuntime = reportLines.some(line => /^(?:ConOut|MsgInfo|MsgStop|MsgAlert|Alert)\s*\(/i.test(line));
    if (hasMixedRuntime) {
      const events = [];
      for (const line of reportLines) {
        let match = line.match(/^ConOut\s*\((.*)\)$/i);
        if (match) {
          events.push({ type: "console", text: splitArguments(match[1]).map(argument => String(evaluate(argument, runtimeVariables))).join(" ") });
          continue;
        }
        match = line.match(/^(Msg(?:Info|Stop|Alert)|Alert)\s*\((.*)\)$/i);
        if (match) {
          const args = splitArguments(match[2]);
          const kind = /^Alert$/i.test(match[1]) ? "stop" : match[1].replace(/^Msg/i, "").toLowerCase();
          events.push({ type: "message", kind, text: String(evaluate(args[0], runtimeVariables)), title: args[1] ? String(evaluate(args[1], runtimeVariables)) : "TOTVS" });
          continue;
        }
        if (/\b(?:FWMSPrinter|TMSPrinter)\s*\(\s*\)\s*:\s*New/i.test(line)) events.push({ type: "report-create" });
        else if (/^\w+\s*:\s*Setup\s*\(\s*\)/i.test(line)) events.push({ type: "report-setup" });
        else if (/^\w+\s*:\s*Preview\s*\(\s*\)/i.test(line)) events.push({ type: "report-preview" });
      }
      program.events = events;
      program.variables = runtimeVariables;
      program.diagnostics = diagnose(source);
    }
    return program;
  }

  function tableRows(tables, alias) {
    if (!alias || !tables) return [];
    const key = Object.keys(tables).find(name => name.toLowerCase() === alias.toLowerCase());
    return key && Array.isArray(tables[key]) ? tables[key] : [];
  }

  function fieldValue(record, field) {
    if (!record || !field) return "";
    const key = Object.keys(record).find(name => name.toLowerCase() === field.toLowerCase());
    return key ? record[key] : "";
  }

  function parseAxCadastro(source, options = {}) {
    const line = statements(source).find(statement => /^AxCadastro\s*\(/i.test(statement));
    if (!line) return null;
    const match = line.match(/^AxCadastro\s*\(([\s\S]*)\)$/i);
    if (!match) return null;
    const args = splitArguments(match[1]);
    const alias = unquote(args[0] || "");
    const title = unquote(args[1] || "Cadastro");
    const functionBodies = Object.create(null);
    const functionPattern = /(?:User|Static)\s+Function\s+(\w+)\s*\([^)]*\)([\s\S]*?)(?=(?:User|Static)\s+Function\b|$)/gi;
    for (const functionMatch of source.matchAll(functionPattern)) functionBodies[functionMatch[1].toLowerCase()] = functionMatch[2];
    const messageEvents = value => {
      let body = String(value || "").trim();
      const block = codeBlockBody(body);
      if (block != null) body = block;
      const functionCall = body.match(/^(?:U_)?(\w+)\s*(?:\(.*\))?$/i);
      if (functionCall && functionBodies[functionCall[1].toLowerCase()]) body = functionBodies[functionCall[1].toLowerCase()];
      const events = [];
      for (const message of body.matchAll(/\b(Msg(?:Info|Stop|Alert)|Alert)\s*\(([^)]*)\)/gi)) {
        const messageArgs = splitArguments(message[2]);
        const kind = /^Alert$/i.test(message[1]) ? "stop" : message[1].replace(/^Msg/i, "").toLowerCase();
        events.push({ type: "message", kind, text: String(evaluate(messageArgs[0])), title: messageArgs[1] ? String(evaluate(messageArgs[1])) : "TOTVS" });
      }
      return events;
    };
    const localBlocks = Object.create(null);
    for (const local of source.matchAll(/Local\s+(\w+)\s*:=\s*(\{\s*\|[^|]*\|[^\r\n]*\})/gi)) localBlocks[local[1].toLowerCase()] = local[2];
    const resolveCallback = value => {
      const token = String(value || "").trim();
      return messageEvents(localBlocks[token.toLowerCase()] || unquote(token));
    };
    const additionalActions = [];
    const customButtons = [];
    for (const addLine of statements(source).filter(statement => /^AAdd\s*\(/i.test(statement))) {
      const add = addLine.match(/^AAdd\s*\(\s*(\w+)\s*,\s*\{([\s\S]*)\}\s*\)$/i);
      if (!add) continue;
      const values = splitArguments(add[2]);
      if (/aRotAdic/i.test(add[1])) additionalActions.push({ label: unquote(values[0]), events: messageEvents(unquote(values[1])) });
      if (/aButtons/i.test(add[1])) customButtons.push({ label: unquote(values[0]), title: unquote(values[2]), tooltip: unquote(values[3]), events: messageEvents(values[1]) });
    }
    const rows = tableRows(options.tables, alias);
    const columns = rows.length ? Object.keys(rows[0]).map(field => ({ field, label: field.replace(/^\w\d?_/, "") })) : [];
    return {
      kind: "axcadastro", version: VERSION, title, alias, rows, columns,
      callbacks: {
        delete: messageEvents(unquote(args[2])), confirm: messageEvents(unquote(args[3])),
        pre: resolveCallback(args[5]), ok: resolveCallback(args[6]),
        duringTransaction: resolveCallback(args[7]), afterTransaction: resolveCallback(args[8])
      },
      additionalActions, customButtons, controls: [], variables: Object.create(null), diagnostics: diagnose(source)
    };
  }

  function parse(source, options = {}) {
    const axCadastroProgram = parseAxCadastro(source, options);
    if (axCadastroProgram) return axCadastroProgram;
    const reportProgram = parseReport(source);
    if (reportProgram) return reportProgram;
    const messageProgram = /\bDEFINE\s+(?:MS)?DIALOG\b|MSDialog\s*\(\s*\)\s*:\s*New/i.test(source) ? null : parseMessageProgram(source);
    if (messageProgram) return messageProgram;
    const lines = statements(source);
    const variables = Object.create(null);
    for (const line of lines) {
      const local = line.match(/^Local\s+(\w+)(?:\s*:=\s*(.+))?$/i);
      if (local) variables[local[1]] = local[2] == null ? null : evaluate(local[2], variables);
    }
    let dialog = null;
    const controls = [];
    for (const line of lines) {
      const constructor = line.match(/^Local\s+(\w+)\s*:=\s*MSDialog\s*\(\s*\)\s*:\s*New\s*\(([\s\S]*)\)$/i);
      if (constructor) {
        const args = splitArguments(constructor[2]);
        dialog = {
          variable: constructor[1], title: unquote(args[4] || "MSDialog"),
          top: numeric(args[0]), left: numeric(args[1]), bottom: numeric(args[2], 240), right: numeric(args[3], 480),
          pixel: true, centered: false, constructor: "MSDialog():New", validation: null, initialization: null
        };
        continue;
      }
      let match = line.match(/^DEFINE\s+(?:MS)?DIALOG\s+(\w+)/i);
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
      match = line.match(/^ACTIVATE\s+DIALOG\s+(\w+)/i);
      if (match && dialog) { dialog.centered = /\bCENTERED\b/i.test(line); continue; }
      match = line.match(/^(\w+)\s*:\s*Activate\s*\(([\s\S]*)\)$/i);
      if (match && dialog && match[1].toLowerCase() === dialog.variable.toLowerCase()) {
        const args = splitArguments(match[2]);
        dialog.centered = /^\.T\.$/i.test(args[3] || "");
        dialog.validation = codeBlockBody(args[4]);
        dialog.initialization = codeBlockBody(args[6]);
        continue;
      }
      match = line.match(/^(\w+)\s*:=\s*(TWBrowse|TCBrowse)\s*\(\s*\)\s*:\s*New\s*\(([\s\S]*)\)$/i);
      if (match) {
        const args = splitArguments(match[3]);
        controls.push({
          type: "BROWSE", objectVariable: match[1], row: numeric(args[0]) * 2, col: numeric(args[1]) * 2,
          width: numeric(args[2], 260) * 2, height: numeric(args[3], 184) * 2,
          headers: parseArray(args[5]) || [], columnWidths: parseArray(args[6]) || [], rows: [], arrayVariable: null,
          sourceClass: match[2], toggleOnDoubleClick: false, doubleClickMessage: null,
          doubleClickAction: null, headerClick: false, headerClickAction: null, formats: {}
        });
        continue;
      }
      match = line.match(/^(\w+)\s*:=\s*BrGetDDB\s*\(\s*\)\s*:\s*New\s*\(([\s\S]*)\)$/i);
      if (match) {
        const args = splitArguments(match[2]);
        const aliases = args.map(unquote).filter(value => /^[A-Z][A-Z0-9_]{1,9}$/i.test(value));
        controls.push({
          type: "GETDADOS", objectVariable: match[1], row: numeric(args[0]) * 2, col: numeric(args[1]) * 2,
          width: numeric(args[2], 260) * 2, height: numeric(args[3], 184) * 2,
          headers: [], columns: [], rows: [], dataSource: aliases.at(-1) || null,
          customEdit: false, deleteAction: false
        });
        continue;
      }
      match = line.match(/^@\s*([\d.]+)\s*,\s*([\d.]+)\s+(SAY|GET|MSGET|BUTTON|CHECKBOX)\b\s*(.*)$/i);
      if (!match) {
        const buttonConstructor = line.match(/^TButton\s*\(\s*\)\s*:\s*New\s*\(([\s\S]*)\)$/i);
        if (buttonConstructor) {
          const args = splitArguments(buttonConstructor[1]);
          const action = codeBlockBody(args[4]) || args[4] || "";
          const browseTarget = action.match(/(\w+)\s*:\s*(GoUp|GoDown|GoTop|GoBottom|nRowCount)\s*\(/i);
          const browseProperty = action.match(/(\w+)\s*:\s*(nAt|nLen|cAlias)\b/i);
          controls.push({
            type: "TBUTTON", row: numeric(args[0]) * 2, col: numeric(args[1]) * 2,
            width: numeric(args[5], 40) * 2, height: numeric(args[6], 10) * 2,
            text: unquote(args[2]), action,
            browseTarget: browseTarget?.[1] || browseProperty?.[1] || null,
            browseCommand: browseTarget?.[2] || browseProperty?.[2] || null
          });
        }
        continue;
      }
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
    for (const line of lines) {
      const assignment = line.match(/^(\w+)\s*:=\s*(\{[\s\S]*\})$/i);
      if (assignment) variables[assignment[1]] = parseArray(assignment[2]);
      const setArray = line.match(/^(\w+)\s*:\s*SetArray\s*\(\s*(\w+)\s*\)$/i);
      if (setArray) {
        const browse = controls.find(control => control.type === "BROWSE" && control.objectVariable.toLowerCase() === setArray[1].toLowerCase());
        if (browse) { browse.arrayVariable = setArray[2]; browse.rows = variables[setArray[2]] || []; }
      }
      const doubleClick = line.match(/^(\w+)\s*:\s*bLDblClick\s*:=/i);
      if (doubleClick) {
        const browse = controls.find(control => control.type === "BROWSE" && control.objectVariable.toLowerCase() === doubleClick[1].toLowerCase());
        if (browse) {
          browse.toggleOnDoubleClick = /!\s*\w+\s*\[.*?\]\s*\[?\s*1/i.test(line);
          browse.doubleClickMessage = /alert\s*\(\s*['"]bLDblClick['"]\s*\)/i.test(line) ? "bLDblClick" : null;
          browse.doubleClickAction = codeBlockBody(line.replace(/^[^:]+:\s*bLDblClick\s*:=\s*/i, ""));
        }
      }
      const headerClick = line.match(/^(\w+)\s*:\s*bHeaderClick\s*:=/i);
      if (headerClick) {
        const browse = controls.find(control => control.type === "BROWSE" && control.objectVariable.toLowerCase() === headerClick[1].toLowerCase());
        if (browse) {
          browse.headerClick = true;
          browse.headerClickAction = codeBlockBody(line.replace(/^[^:]+:\s*bHeaderClick\s*:=\s*/i, ""));
        }
      }
      const browseLine = line.match(/^(\w+)\s*:\s*bLine\s*:=/i);
      if (browseLine) {
        const browse = controls.find(control => control.type === "BROWSE" && control.objectVariable.toLowerCase() === browseLine[1].toLowerCase());
        if (browse && /Transform\s*\([\s\S]*?['"]@E\s+99,999,999,999\.99['"]\s*\)/i.test(line)) browse.formats[3] = "@E 99,999,999,999.99";
      }
      const addColumn = line.match(/^(\w+)\s*:\s*addColumn\s*\(\s*TCColumn\s*\(\s*\)\s*:\s*new\s*\(\s*(['"])(.*?)\2\s*,\s*\{\s*\|\|\s*([\s\S]*?)\s*\}/i);
      if (addColumn) {
        const browse = controls.find(control => control.type === "GETDADOS" && control.objectVariable.toLowerCase() === addColumn[1].toLowerCase());
        if (browse) {
          const field = addColumn[4].match(/(?:\w+\s*->\s*)?(\w+)\s*$/)?.[1] || null;
          browse.columns.push({ title: addColumn[3], field, expression: addColumn[4].trim(), alignment: /['"]LEFT['"]/i.test(line) ? "left" : "left" });
          browse.headers.push(addColumn[3]);
        }
      }
      const customEdit = line.match(/^(\w+)\s*:\s*bCustomEditCol\s*:=/i);
      if (customEdit) {
        const browse = controls.find(control => control.type === "GETDADOS" && control.objectVariable.toLowerCase() === customEdit[1].toLowerCase());
        if (browse) browse.customEdit = true;
      }
      const deleteAction = line.match(/^(\w+)\s*:\s*bDelete\s*:=/i);
      if (deleteAction) {
        const browse = controls.find(control => control.type === "GETDADOS" && control.objectVariable.toLowerCase() === deleteAction[1].toLowerCase());
        if (browse) browse.deleteAction = true;
      }
    }
    for (const browse of controls.filter(control => control.type === "GETDADOS")) {
      browse.rows = tableRows(options.tables, browse.dataSource).map(record => browse.columns.map(column => fieldValue(record, column.field)));
      browse.dataMode = browse.rows.length ? "sample" : "unavailable";
    }
    if (!dialog) throw new Error("Nenhum comando DEFINE MSDIALOG foi encontrado.");
    const activationIndex = lines.findIndex(line => /^ACTIVATE\s+(?:MS)?DIALOG\b|^\w+\s*:\s*Activate\s*\(/i.test(line));
    const runtimeEvents = [];
    const appendConsoleEvent = line => {
      const call = line.match(/^ConOut\s*\((.*)\)$/i);
      if (!call) return;
      const text = splitArguments(call[1]).map(argument => String(evaluate(argument, variables))).join(" ");
      runtimeEvents.push({ type: "console", text });
    };
    lines.slice(0, Math.max(0, activationIndex)).forEach(appendConsoleEvent);
    runtimeEvents.push({ type: "dialog" });
    if (activationIndex >= 0) lines.slice(activationIndex + 1).forEach(appendConsoleEvent);
    return { version: VERSION, dialog, controls, variables, events: runtimeEvents };
  }

  return Object.freeze({ VERSION, API_VERSION, PACKAGE_VERSION, parse, parseReport, parseAxCadastro, evaluate, parseAction, diagnose, statements, splitTopLevel, splitArguments, parseArray });
});
