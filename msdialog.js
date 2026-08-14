(function () {
  "use strict";

  const sourceEl = document.getElementById("source");
  const desktopEl = document.getElementById("desktop");
  const statusEl = document.getElementById("status");
  const overlayEl = document.getElementById("messageOverlay");
  const messageTextEl = document.getElementById("messageText");

  function stripComments(source) {
    return source
      .split(/\r?\n/)
      .map(line => line.replace(/\/\/.*$/, ""))
      .join("\n");
  }

  function logicalStatements(source) {
    const statements = [];
    let current = "";
    for (const rawLine of stripComments(source).split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || /^#/.test(line)) continue;
      current += (current ? " " : "") + line.replace(/;\s*$/, "");
      if (!/;\s*$/.test(line)) {
        statements.push(current.trim());
        current = "";
      }
    }
    if (current) statements.push(current.trim());
    return statements;
  }

  function unquote(value) {
    const text = String(value || "").trim();
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
      return text.slice(1, -1);
    }
    return text;
  }

  function number(value, fallback = 0) {
    const parsed = Number.parseFloat(String(value).replace(/^0+(?=\d)/, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function findClause(statement, name, stopNames) {
    const stops = stopNames.join("|");
    const rx = new RegExp("\\b" + name + "\\s+(.+?)(?=\\s+\\b(?:" + stops + ")\\b|$)", "i");
    const match = statement.match(rx);
    return match ? match[1].trim() : null;
  }

  function parseVariables(statements) {
    const variables = Object.create(null);
    for (const statement of statements) {
      const match = statement.match(/^Local\s+(\w+)(?:\s*:=\s*(.+))?$/i);
      if (!match) continue;
      const [, name, rawValue] = match;
      if (rawValue == null) variables[name] = null;
      else if (/^\.T\.$/i.test(rawValue)) variables[name] = true;
      else if (/^\.F\.$/i.test(rawValue)) variables[name] = false;
      else if (/^["']/.test(rawValue.trim())) variables[name] = unquote(rawValue);
      else variables[name] = number(rawValue, rawValue);
    }
    return variables;
  }

  function parse(source) {
    const statements = logicalStatements(source);
    const variables = parseVariables(statements);
    let dialog = null;
    const controls = [];

    for (const statement of statements) {
      let match = statement.match(/^DEFINE\s+MSDIALOG\s+(\w+)/i);
      if (match) {
        const from = findClause(statement, "FROM", ["TO", "TITLE", "PIXEL", "STYLE"]);
        const to = findClause(statement, "TO", ["FROM", "TITLE", "PIXEL", "STYLE"]);
        const title = findClause(statement, "TITLE", ["FROM", "TO", "PIXEL", "STYLE"]);
        const fromPair = from ? from.split(",") : [0, 0];
        const toPair = to ? to.split(",") : [240, 480];
        dialog = {
          variable: match[1],
          title: unquote(title || "MSDialog"),
          top: number(fromPair[0]),
          left: number(fromPair[1]),
          bottom: number(toPair[0], 240),
          right: number(toPair[1], 480),
          pixel: /\bPIXELS?\b/i.test(statement),
          centered: false
        };
        continue;
      }

      match = statement.match(/^ACTIVATE\s+MSDIALOG\s+(\w+)/i);
      if (match && dialog) {
        dialog.centered = /\bCENTERED\b/i.test(statement);
        continue;
      }

      match = statement.match(/^@\s*([\d.]+)\s*,\s*([\d.]+)\s+(SAY|GET|BUTTON|CHECKBOX)\b\s*(.*)$/i);
      if (!match) continue;

      const [, row, col, rawType, tail] = match;
      const type = rawType.toUpperCase();
      const commonStops = ["SIZE", "OF", "PIXEL", "PROMPT", "VAR", "ACTION", "VALID", "WHEN", "PICTURE"];
      const size = findClause(tail, "SIZE", commonStops.filter(x => x !== "SIZE"));
      const sizePair = size ? size.split(",") : [type === "BUTTON" ? 70 : 100, type === "BUTTON" ? 22 : 12];
      const variableMatch = tail.match(/^(\w+)\b/);
      const quotedMatch = tail.match(/^["']([^"']*)["']/);
      const prompt = findClause(tail, "PROMPT", commonStops.filter(x => x !== "PROMPT"));
      const boundVar = findClause(tail, "VAR", commonStops.filter(x => x !== "VAR"));
      const action = findClause(tail, "ACTION", commonStops.filter(x => x !== "ACTION"));
      controls.push({
        type,
        row: number(row),
        col: number(col),
        width: number(sizePair[0], 100),
        height: number(sizePair[1], 12),
        objectVariable: variableMatch && !quotedMatch ? variableMatch[1] : null,
        text: quotedMatch ? quotedMatch[1] : unquote(prompt || ""),
        boundVar: boundVar ? boundVar.match(/^\w+/)?.[0] : null,
        action
      });
    }

    if (!dialog) throw new Error("Nenhum comando DEFINE MSDIALOG foi encontrado.");
    return { dialog, controls, variables };
  }

  function expressionValue(expression, state) {
    return expression
      .split(/\s*\+\s*/)
      .map(part => {
        const token = part.trim();
        if (/^["']/.test(token)) return unquote(token);
        return state.variables[token] == null ? "" : String(state.variables[token]);
      })
      .join("");
  }

  function executeAction(action, state) {
    if (!action) return;
    if (/\w+\s*:\s*End\s*\(\s*\)/i.test(action)) {
      state.dialogElement.remove();
      setStatus("Diálogo encerrado por oDlg:End().", "success");
      return;
    }
    const msg = action.match(/MsgInfo\s*\((.*)\)/i);
    if (msg) showMessage(expressionValue(msg[1], state));
  }

  function applyPosition(element, control) {
    element.classList.add("ms-control");
    element.style.top = control.row + "px";
    element.style.left = control.col + "px";
    element.style.width = control.width + "px";
    element.style.height = control.height + "px";
  }

  function createControl(control, state) {
    let element;
    if (control.type === "SAY") {
      element = document.createElement("div");
      element.className = "ms-say";
      element.textContent = control.text;
    } else if (control.type === "GET") {
      element = document.createElement("input");
      element.className = "ms-get";
      element.type = "text";
      element.value = state.variables[control.boundVar] ?? "";
      element.addEventListener("input", () => { state.variables[control.boundVar] = element.value; });
    } else if (control.type === "CHECKBOX") {
      element = document.createElement("label");
      element.className = "ms-checkbox";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = Boolean(state.variables[control.boundVar]);
      input.addEventListener("change", () => { state.variables[control.boundVar] = input.checked; });
      element.append(input, document.createTextNode(control.text));
    } else {
      element = document.createElement("button");
      element.className = "ms-button";
      element.textContent = control.text || "Button";
      element.addEventListener("click", () => executeAction(control.action, state));
    }
    applyPosition(element, control);
    return element;
  }

  function render(program) {
    desktopEl.replaceChildren();
    const { dialog } = program;
    const width = Math.max(220, dialog.right - dialog.left);
    const height = Math.max(120, dialog.bottom - dialog.top);
    const dialogEl = document.createElement("section");
    dialogEl.className = "ms-dialog";
    dialogEl.style.width = width + "px";
    dialogEl.style.height = (height + 30) + "px";
    if (dialog.centered) {
      dialogEl.style.left = "50%";
      dialogEl.style.top = "50%";
      dialogEl.style.transform = "translate(-50%, -50%)";
    } else {
      dialogEl.style.left = Math.max(0, dialog.left) + "px";
      dialogEl.style.top = Math.max(0, dialog.top) + "px";
    }

    const titlebar = document.createElement("div");
    titlebar.className = "ms-titlebar";
    titlebar.textContent = dialog.title;
    const client = document.createElement("div");
    client.className = "ms-client";
    client.style.height = height + "px";
    const state = { variables: { ...program.variables }, dialogElement: dialogEl };
    for (const control of program.controls) client.append(createControl(control, state));
    dialogEl.append(titlebar, client);
    desktopEl.append(dialogEl);
    setStatus(`Tela montada: ${program.controls.length} controle(s).`, "success");
  }

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = "status" + (kind ? " " + kind : "");
  }

  function showMessage(text) {
    messageTextEl.textContent = text;
    overlayEl.hidden = false;
    document.getElementById("messageOk").focus();
  }

  document.getElementById("runButton").addEventListener("click", () => {
    try { render(parse(sourceEl.value)); }
    catch (error) { setStatus(error.message, "error"); }
  });
  document.getElementById("messageOk").addEventListener("click", () => { overlayEl.hidden = true; });
  sourceEl.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      document.getElementById("runButton").click();
    }
  });

  document.getElementById("runButton").click();
})();
