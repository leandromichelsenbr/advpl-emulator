(function (core) {
  "use strict";
  if (!core) throw new Error("AdvPLCore não foi carregado.");

  const sourceEl = document.getElementById("source");
  const desktopEl = document.getElementById("desktop");
  const statusEl = document.getElementById("status");
  const overlayEl = document.getElementById("messageOverlay");
  const messageTextEl = document.getElementById("messageText");
  let messageResolver = null;

  function setStatus(text, kind) { statusEl.textContent = text; statusEl.className = "status" + (kind ? " " + kind : ""); }
  function showMessage(text) {
    messageTextEl.textContent = text; overlayEl.hidden = false; document.getElementById("messageOk").focus();
    return new Promise(resolve => { messageResolver = resolve; });
  }
  async function executeAction(action, state) {
    for (const command of core.parseAction(action)) {
      if (command.type === "message") await showMessage(core.evaluate(command.expression, state.variables));
      if (command.type === "end") { state.dialogElement.remove(); setStatus("Diálogo encerrado por oDlg:End().", "success"); }
    }
  }
  function position(element, control) {
    element.classList.add("ms-control");
    Object.assign(element.style, { top: control.row + "px", left: control.col + "px", width: control.width + "px", height: control.height + "px" });
  }
  function createControl(control, state) {
    let element;
    if (control.type === "SAY") { element = document.createElement("div"); element.className = "ms-say"; element.textContent = control.text; }
    else if (control.type === "GET") { element = document.createElement("input"); element.className = "ms-get"; element.type = "text"; element.value = state.variables[control.boundVar] ?? ""; element.addEventListener("input", () => { state.variables[control.boundVar] = element.value; }); }
    else if (control.type === "CHECKBOX") { element = document.createElement("label"); element.className = "ms-checkbox"; const input = document.createElement("input"); input.type = "checkbox"; input.checked = Boolean(state.variables[control.boundVar]); input.addEventListener("change", () => { state.variables[control.boundVar] = input.checked; }); element.append(input, document.createTextNode(control.text)); }
    else { element = document.createElement("button"); element.className = "ms-button"; element.textContent = control.text || "Button"; element.addEventListener("click", () => { void executeAction(control.action, state); }); }
    position(element, control); return element;
  }
  function render(program) {
    desktopEl.replaceChildren();
    const width = Math.max(220, program.dialog.right - program.dialog.left);
    const height = Math.max(120, program.dialog.bottom - program.dialog.top);
    const dialogEl = document.createElement("section"); dialogEl.className = "ms-dialog";
    Object.assign(dialogEl.style, { width: width + "px", height: height + 30 + "px", left: program.dialog.centered ? "50%" : Math.max(0, program.dialog.left) + "px", top: program.dialog.centered ? "50%" : Math.max(0, program.dialog.top) + "px", transform: program.dialog.centered ? "translate(-50%, -50%)" : "none" });
    const titlebar = document.createElement("div"); titlebar.className = "ms-titlebar"; titlebar.textContent = program.dialog.title;
    const client = document.createElement("div"); client.className = "ms-client"; client.style.height = height + "px";
    const state = { variables: { ...program.variables }, dialogElement: dialogEl };
    for (const control of program.controls) client.append(createControl(control, state));
    dialogEl.append(titlebar, client); desktopEl.append(dialogEl); setStatus(`Tela montada: ${program.controls.length} controle(s). Núcleo ${core.VERSION}.`, "success");
  }

  document.getElementById("runButton").addEventListener("click", () => { try { render(core.parse(sourceEl.value)); } catch (error) { setStatus(error.message, "error"); } });
  document.getElementById("messageOk").addEventListener("click", () => { overlayEl.hidden = true; const resolve = messageResolver; messageResolver = null; if (resolve) resolve(); });
  sourceEl.addEventListener("keydown", event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); document.getElementById("runButton").click(); } });
  document.getElementById("runButton").click();
})(globalThis.AdvPLCore);

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