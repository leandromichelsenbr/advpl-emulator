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
