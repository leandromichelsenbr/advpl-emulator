(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AdvPLFWDialogs = api;

  if (typeof document !== "undefined") api.install(document);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function splitArguments(expression) {
    const result = [];
    let current = "";
    let depth = 0;
    let quote = null;

    for (const char of String(expression || "")) {
      if (quote) {
        current += char;
        if (char === quote) quote = null;
      } else if (char === '"' || char === "'") {
        quote = char;
        current += char;
      } else if (char === "(") {
        depth += 1;
        current += char;
      } else if (char === ")") {
        depth -= 1;
        current += char;
      } else if (char === "," && depth === 0) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    if (current.trim()) result.push(current.trim());
    return result;
  }

  function splitConcatenation(expression) {
    const result = [];
    let current = "";
    let depth = 0;
    let quote = null;

    for (const char of String(expression || "")) {
      if (quote) {
        current += char;
        if (char === quote) quote = null;
      } else if (char === '"' || char === "'") {
        quote = char;
        current += char;
      } else if (char === "(") {
        depth += 1;
        current += char;
      } else if (char === ")") {
        depth -= 1;
        current += char;
      } else if (char === "+" && depth === 0) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result.filter(Boolean);
  }

  function unquote(value) {
    const text = String(value || "").trim();
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
      return text.slice(1, -1);
    }
    return text;
  }

  function functionName(source) {
    const match = String(source || "").match(/\b(?:User\s+Function|Static\s+Function|Function)\s+(\w+)/i);
    return match ? match[1].toUpperCase() : "";
  }

  function collectVariables(source) {
    const variables = Object.create(null);
    const text = String(source || "");
    const assignmentPattern = /\b(?:Local\s+)?(\w+)\s*:=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/gi;
    const defaultPattern = /\bDefault\s+(\w+)\s*:=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/gi;
    let match;

    while ((match = assignmentPattern.exec(text))) variables[match[1].toLowerCase()] = unquote(match[2]);
    while ((match = defaultPattern.exec(text))) {
      const key = match[1].toLowerCase();
      if (variables[key] == null || variables[key] === "") variables[key] = unquote(match[2]);
    }

    return variables;
  }

  function evaluate(expression, variables, source) {
    const parts = splitConcatenation(expression);
    return parts.map(part => {
      const token = part.trim();
      if (!token) return "";
      if (/^["']/.test(token)) return unquote(token);
      if (/^FunName\s*\(\s*\)$/i.test(token)) return functionName(source);
      if (/^Space\s*\(/i.test(token)) {
        const count = Number(token.match(/\((\d+)\)/)?.[1] || 0);
        return " ".repeat(Math.max(0, count));
      }
      return variables[token.toLowerCase()] == null ? "" : String(variables[token.toLowerCase()]);
    }).join("");
  }

  function findCall(source, names) {
    const text = String(source || "");
    const namePattern = names.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const start = new RegExp("\\b(" + namePattern + ")\\s*\\(", "i").exec(text);
    if (!start) return null;

    let index = start.index + start[0].length;
    let depth = 1;
    let quote = null;
    let body = "";

    for (; index < text.length; index += 1) {
      const char = text[index];
      if (quote) {
        body += char;
        if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        body += char;
        continue;
      }
      if (char === "(") depth += 1;
      if (char === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
      body += char;
    }

    return { name: start[1], args: splitArguments(body), start: start.index, end: index + 1 };
  }

  function parseProgram(source) {
    const text = String(source || "");
    const confirm = findCall(text, ["FWMsgAlertYesNo", "FWAlertYesNo"]);
    const log = findCall(text, ["ShowLog"]);
    if (!confirm || !log) return null;

    const variables = collectVariables(text);
    const message = evaluate(confirm.args[0] || '""', variables, text);
    const title = evaluate(confirm.args[1] || '"Atenção"', variables, text) || "Atenção";
    const logText = evaluate(log.args[0] || '""', variables, text);

    return {
      kind: "fw-confirm-showlog",
      confirmation: { message, title },
      log: { text: logText, title: "Log de ocorrências - Pré-Geração" },
      functionName: functionName(text),
      variables
    };
  }

  function ensureStyles(doc) {
    if (doc.getElementById("fwDialogRuntimeStyles")) return;
    const style = doc.createElement("style");
    style.id = "fwDialogRuntimeStyles";
    style.textContent = `
      .fw-showlog-overlay{position:fixed;inset:0;z-index:3200;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.18);font-family:Arial,sans-serif}
      .fw-showlog-dialog{width:min(727px,calc(100vw - 32px));height:min(477px,calc(100vh - 32px));background:#fbfbfb;color:#000;border:1px solid #888;box-shadow:0 8px 28px rgba(0,0,0,.3);display:flex;flex-direction:column;font-size:11px}
      .fw-showlog-title{height:30px;display:flex;align-items:center;padding:0 10px;background:#fbfbfb;border-bottom:1px solid #d3d3d3;font-weight:400;user-select:none}
      .fw-showlog-content{flex:1;padding:44px 16px 16px;min-height:0}
      .fw-showlog-text{box-sizing:border-box;width:100%;height:100%;resize:none;padding:8px;font:700 11px/1.4 "Courier New",monospace;color:#4d4d4d;background:#fbfbfb;border:2px ridge #ccc;border-radius:3px;outline:none;white-space:pre;overflow:auto}
      .fw-showlog-text:hover,.fw-showlog-text:focus{border-color:#00659a;background:#fbfbfb}
      .fw-showlog-actions{height:60px;display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:0 17px;background:#fbfbfb;border-top:1px solid #e2e2e2}
      .fw-showlog-actions button{height:35px;border-radius:3px;padding:0 14px;font:11px Arial;cursor:pointer}
      .fw-showlog-primary{color:#fbfbfb;background:#00659a;border:2px solid transparent}
      .fw-showlog-primary:hover{background:#004064}
      .fw-showlog-secondary{color:#00659a;background:transparent;border:2px solid #00659a}
      .fw-showlog-secondary:hover{color:#051f31;background:#afd3fa;border-color:#051f31}
      .fw-showlog-menu{margin-right:auto;color:#00659a;background:transparent;border:2px solid #00659a}
      .fw-showlog-menu::after{content:" ▾"}
      .fw-showlog-overlay[hidden]{display:none}
    `;
    doc.head.append(style);
  }

  function showLog(doc, options, onClose) {
    ensureStyles(doc);
    const overlay = doc.createElement("div");
    overlay.className = "fw-showlog-overlay";
    overlay.setAttribute("role", "presentation");

    const dialog = doc.createElement("wa-dialog");
    dialog.className = "fw-showlog-dialog dict-msdialog";
    dialog.dataset.advpl = "tdialog";
    dialog.setAttribute("opened", "");
    dialog.setAttribute("state", "normal");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", options.title || "Log de ocorrências - Pré-Geração");

    const title = doc.createElement("div");
    title.className = "fw-showlog-title";
    title.textContent = options.title || "Log de ocorrências - Pré-Geração";

    const content = doc.createElement("div");
    content.className = "fw-showlog-content";
    const text = doc.createElement("textarea");
    text.className = "fw-showlog-text dict-tmultiget";
    text.readOnly = true;
    text.value = String(options.text || "");
    text.setAttribute("data-advpl", "tmultiget");
    content.append(text);

    const actions = doc.createElement("div");
    actions.className = "fw-showlog-actions";
    const menu = doc.createElement("button");
    menu.className = "fw-showlog-menu";
    menu.textContent = "Outras Ações";
    const cancel = doc.createElement("button");
    cancel.className = "fw-showlog-secondary";
    cancel.textContent = "Cancelar";
    const confirm = doc.createElement("button");
    confirm.className = "fw-showlog-primary";
    confirm.textContent = "Confirmar";
    actions.append(menu, cancel, confirm);

    dialog.append(title, content, actions);
    overlay.append(dialog);
    doc.body.append(overlay);

    function close() {
      overlay.remove();
      doc.removeEventListener("keydown", onKeyDown, true);
      if (onClose) onClose();
    }
    function onKeyDown(event) {
      if (event.key === "Escape") { event.preventDefault(); close(); }
    }

    cancel.addEventListener("click", close);
    confirm.addEventListener("click", close);
    menu.addEventListener("click", () => text.select());
    doc.addEventListener("keydown", onKeyDown, true);
    confirm.focus();
    return overlay;
  }

  function showConfirmation(doc, program, onYes, onNo) {
    const overlay = doc.getElementById("confirmOverlay");
    const title = doc.getElementById("confirmTitle");
    const text = doc.getElementById("confirmText");
    const yes = doc.getElementById("confirmYes");
    const no = doc.getElementById("confirmNo");
    if (!overlay || !title || !text || !yes || !no) return false;

    title.textContent = program.confirmation.title;
    text.textContent = program.confirmation.message;
    overlay.hidden = false;

    const cleanup = () => {
      overlay.hidden = true;
      yes.onclick = null;
      no.onclick = null;
    };
    yes.onclick = () => { cleanup(); onYes(); };
    no.onclick = () => { cleanup(); if (onNo) onNo(); };
    yes.focus();
    return true;
  }

  function install(doc) {
    const runButton = doc.getElementById("runButton");
    const source = doc.getElementById("source");
    const status = doc.getElementById("status");
    if (!runButton || !source) return false;
    if (runButton.dataset.fwDialogsInstalled === "1") return true;
    runButton.dataset.fwDialogsInstalled = "1";

    runButton.addEventListener("click", event => {
      const program = parseProgram(source.value);
      if (!program) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      if (status) {
        status.textContent = "Aguardando confirmação do FWMsgAlertYesNo...";
        status.className = "status";
      }

      showConfirmation(doc, program, () => {
        if (status) status.textContent = "ShowLog aberto.";
        showLog(doc, program.log, () => {
          if (status) {
            status.textContent = "Execução concluída.";
            status.className = "status success";
          }
        });
      }, () => {
        if (status) {
          status.textContent = "Execução cancelada pelo usuário.";
          status.className = "status";
        }
      });
    });

    return true;
  }

  return { splitArguments, functionName, collectVariables, evaluate, findCall, parseProgram, showLog, install };
});
