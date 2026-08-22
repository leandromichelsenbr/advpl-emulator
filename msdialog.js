(function () {
  "use strict";

  const sourceEl = document.getElementById("source");
  const desktopEl = document.getElementById("desktop");
  const statusEl = document.getElementById("status");
  const overlayEl = document.getElementById("messageOverlay");
  const messageTextEl = document.getElementById("messageText");
  const highlightingEl = document.getElementById("highlighting");
  const highlightingContentEl = document.getElementById("highlightingContent");
  const confirmOverlayEl = document.getElementById("confirmOverlay");
  const printerSetupOverlayEl = document.getElementById("printerSetupOverlay");
  const legacyPrinterSetupOverlayEl = document.getElementById("legacyPrinterSetupOverlay");
  const messageTitleEl = document.getElementById("messageTitle") || document.querySelector(".message-title");
  const emulatorConfig = globalThis.ADVPL_EMULATOR_CONFIG || {};
  const headless = emulatorConfig.headless === true || new URLSearchParams(globalThis.location?.search || "").get("headless") === "1";

  // Permite que páginas externas carreguem o arquivo sem adotar o shell completo da demonstração.
  if (!sourceEl || !desktopEl || !statusEl) return;
  document.documentElement.classList.toggle("headless", headless);
  const brandEl = document.createElement("div");
  brandEl.className = "emulator-brand";
  brandEl.textContent = `advpl-emulator · powered by Usina.BR · v${AdvPLCore.PACKAGE_VERSION}`;
  brandEl.setAttribute("aria-label", brandEl.textContent);
  document.body.append(brandEl);

  function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function highlightAdvPL(source) {
    const tokens = [];
    const pattern = /(\/\/[^\r\n]*|^\s*#\s*\w+|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\.(?:T|F)\.|\b\d+(?:\.\d+)?\b|\b(?:User\s+Function|Static\s+Function|Function|Return|Local|Private|Public|Static|If|ElseIf|Else|EndIf|For|Next|While|EndDo|Do\s+Case|Case|Otherwise|EndCase|DEFINE|ACTIVATE|DIALOG|MSDIALOG|TITLE|FROM|TO|PIXEL|CENTERED|SIZE|OF|PROMPT|VAR|ACTION|VALID|WHEN|PICTURE)\b|\b(?:MSDialog|TWBrowse|LoadBitmap|GetResources|MsgInfo|MsgStop|Space|AllTrim|If)\b|:\s*\w+)/gim;
    let lastIndex = 0;
    source.replace(pattern, (match, _capture, offset) => {
      tokens.push(escapeHtml(source.slice(lastIndex, offset)));
      let kind = "plain";
      if (/^\/\//.test(match)) kind = "comment";
      else if (/^\s*#/.test(match)) kind = "directive";
      else if (/^["']/.test(match)) kind = "string";
      else if (/^\.(?:T|F)\.$/i.test(match)) kind = "boolean";
      else if (/^\d/.test(match)) kind = "number";
      else if (/^:/.test(match)) kind = "method";
      else if (/^(?:MSDialog|TWBrowse|LoadBitmap|GetResources|MsgInfo|MsgStop|Space|AllTrim|If)$/i.test(match)) kind = "function";
      else kind = "keyword";
      tokens.push(`<span class="syntax-${kind}">${escapeHtml(match)}</span>`);
      lastIndex = offset + match.length;
      return match;
    });
    tokens.push(escapeHtml(source.slice(lastIndex)));
    return tokens.join("") + (source.endsWith("\n") ? " " : "");
  }

  function updateHighlighting() {
    if (!highlightingEl || !highlightingContentEl) return;
    highlightingContentEl.innerHTML = highlightAdvPL(sourceEl.value);
    highlightingEl.scrollTop = sourceEl.scrollTop;
    highlightingEl.scrollLeft = sourceEl.scrollLeft;
  }

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

  function executeAction(action, state, done) {
    const actions = AdvPLCore.parseAction(action || "");
    let index = 0;
    let result = true;
    function next() {
      const item = actions[index++];
      if (!item) { if (done) done(result); return; }
      if (item.type === "message") {
        showMessage(AdvPLCore.evaluate(item.expression, state.variables), item.kind, next);
      } else if (item.type === "end") {
        state.dialogElement.remove();
        setStatus("Diálogo encerrado.", "success");
        next();
      } else if (item.type === "return") {
        result = item.value; next();
      } else next();
    }
    next();
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
    if (control.type === "BROWSE" || control.type === "GETDADOS") {
      const getDados = control.type === "GETDADOS";
      element = document.createElement(getDados ? "wa-tgetdados" : "wa-tcbrowse");
      element.id = getDados ? "COMP4501" : "COMP3001";
      element.dataset.advpl = getDados ? "msbrgetdbase" : "tcbrowse";
      element.className = "ms-browse " + (getDados ? "ms-getdados dict-brgetddb" : "dict-twbrowse");
      element.setAttribute("selection-mode", getDados ? "cell" : "row");
      element.setAttribute("headerheight", getDados ? "22" : "27");
      element.setAttribute("alternateinterval", "1");
      element.setAttribute("rowheight", "17");
      element.setAttribute("scrolltype", getDados ? "button" : "standard");
      if (control.dataSource) element.setAttribute("data-alias", control.dataSource);
      const table = document.createElement("table");
      const head = document.createElement("thead");
      const headerRow = document.createElement("tr");
      const headers = control.headers.length ? control.headers : (getDados ? [] : ["", "Código", "Descrição"]);
      headers.forEach(label => { const th = document.createElement("th"); th.textContent = label; headerRow.append(th); });
      head.append(headerRow);
      const body = document.createElement("tbody");
      let selected = 0;
      let selectedColumn = 0;
      function draw() {
        body.replaceChildren();
        control.rows.forEach((row, rowIndex) => {
          const tr = document.createElement("tr");
          if (!getDados && rowIndex === selected) tr.className = "selected";
          const shown = [row[0], ...row.slice(1, headers.length)];
          shown.forEach((value, columnIndex) => {
            const td = document.createElement("td");
            if (!getDados && columnIndex === 0) {
              const lamp = document.createElement("span");
              lamp.className = "browse-lamp " + (value ? "yes" : "no");
              td.append(lamp);
            } else td.textContent = value == null ? "" : String(value);
            if (getDados && rowIndex === selected && columnIndex === selectedColumn) td.classList.add("selected-cell");
            td.addEventListener("click", () => { selected = rowIndex; selectedColumn = columnIndex; draw(); });
            tr.append(td);
          });
          if (!getDados) tr.addEventListener("click", () => { selected = rowIndex; draw(); });
          tr.addEventListener("dblclick", () => {
            selected = rowIndex;
            if (control.toggleOnDoubleClick) control.rows[rowIndex][0] = !control.rows[rowIndex][0];
            if (getDados && control.customEdit) showMessage("editLine", "stop");
            draw();
          });
          body.append(tr);
        });
      }
      draw();
      table.append(head, body);
      element.append(table);
    } else if (control.type === "SAY") {
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
    if (program.kind === "report") {
      desktopEl.replaceChildren();
      if (program.setup?.enabled) showPrinterSetup(program);
      else if (program.confirmation) showReportConfirmation(program);
      else renderReport(program.report);
      return;
    }
    desktopEl.replaceChildren();
    const { dialog } = program;
    const width = Math.max(220, dialog.right - dialog.left);
    const height = Math.max(120, dialog.bottom - dialog.top);
    const dialogEl = document.createElement("wa-dialog");
    dialogEl.id = "COMP3000";
    dialogEl.dataset.advpl = "tdialog";
    dialogEl.className = "ms-dialog dict-tdialog";
    dialogEl.setAttribute("opened", "");
    dialogEl.setAttribute("state", "normal");
    dialogEl.setAttribute("title", dialog.title);
    dialogEl.style.width = (width + 6) + "px";
    dialogEl.style.height = (height + 29) + "px";
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
    const caption = document.createElement("span");
    caption.textContent = dialog.title;
    const close = document.createElement("button");
    close.className = "ms-close";
    close.type = "button";
    close.setAttribute("aria-label", "Fechar");
    close.textContent = "×";
    titlebar.append(caption, close);
    const client = document.createElement("div");
    client.className = "ms-client";
    client.style.height = height + "px";
    const state = { variables: { ...program.variables }, dialogElement: dialogEl };
    close.addEventListener("click", () => {
      const finish = allowed => {
        if (allowed !== false) {
          dialogEl.remove();
          setStatus("Diálogo encerrado.", "success");
        }
      };
      if (dialog.validation) executeAction(dialog.validation, state, finish);
      else finish(true);
    });
    for (const control of program.controls) client.append(createControl(control, state));
    dialogEl.append(titlebar, client);
    desktopEl.append(dialogEl);
    setStatus(`Tela montada: ${program.controls.length} controle(s).`, "success");
    if (dialog.initialization) executeAction(dialog.initialization, state);
  }

  function showPrinterSetup(program) {
    if (program.setup.variant === "legacy") {
      if (!legacyPrinterSetupOverlayEl) { renderReport(program.report); return; }
      document.getElementById(program.report.orientation === "landscape" ? "legacyLandscape" : "legacyPortrait").checked = true;
      legacyPrinterSetupOverlayEl.hidden = false;
      document.getElementById("legacyPrinterOk").onclick = () => {
        program.report.orientation = document.querySelector('input[name="legacyOrientation"]:checked').value;
        legacyPrinterSetupOverlayEl.hidden = true; renderReport(program.report);
      };
      document.getElementById("legacyPrinterCancel").onclick = () => { legacyPrinterSetupOverlayEl.hidden = true; setStatus("Configuração de impressão cancelada.", ""); };
      document.getElementById("legacyPrinterOk").focus();
      return;
    }
    if (!printerSetupOverlayEl) { renderReport(program.report); return; }
    const orientationSelect = document.getElementById("printerOrientation");
    orientationSelect.value = program.report.orientation;
    printerSetupOverlayEl.hidden = false;
    document.getElementById("printerSetupOk").onclick = () => {
      program.report.orientation = orientationSelect.value;
      program.report.orientationSource = "Setup";
      printerSetupOverlayEl.hidden = true;
      renderReport(program.report);
    };
    document.getElementById("printerSetupCancel").onclick = () => {
      printerSetupOverlayEl.hidden = true;
      setStatus("Configuração de impressão cancelada.", "");
    };
    document.getElementById("printerSetupOk").focus();
  }

  function ean13Bits(rawCode) {
    let code = String(rawCode).replace(/\D/g, "").slice(0, 13);
    if (code.length === 12) {
      const sum = [...code].reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
      code += String((10 - (sum % 10)) % 10);
    }
    if (code.length !== 13) return null;
    const L = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
    const G = ["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"];
    const R = ["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"];
    const parity = ["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"][Number(code[0])];
    let bits = "101";
    for (let index = 1; index <= 6; index += 1) bits += (parity[index - 1] === "L" ? L : G)[Number(code[index])];
    bits += "01010";
    for (let index = 7; index <= 12; index += 1) bits += R[Number(code[index])];
    return { code, bits: bits + "101" };
  }

  function createEan13(element) {
    const encoded = ean13Bits(element.code);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${element.width} ${element.height}`);
    svg.setAttribute("aria-label", `EAN13 ${encoded?.code || element.code}`);
    svg.classList.add("report-barcode");
    if (!encoded) return svg;
    const quiet = 9;
    const moduleWidth = element.width / (95 + quiet * 2);
    const barsHeight = element.height * .78;
    for (let index = 0; index < encoded.bits.length; index += 1) {
      if (encoded.bits[index] !== "1") continue;
      const rect = document.createElementNS(svg.namespaceURI, "rect");
      rect.setAttribute("x", (quiet + index) * moduleWidth);
      rect.setAttribute("y", "0"); rect.setAttribute("width", moduleWidth + .05); rect.setAttribute("height", barsHeight);
      svg.append(rect);
    }
    const text = document.createElementNS(svg.namespaceURI, "text");
    text.setAttribute("x", element.width / 2); text.setAttribute("y", element.height - 2);
    text.setAttribute("text-anchor", "middle"); text.setAttribute("font-family", "Arial"); text.setAttribute("font-size", Math.max(8, element.height * .2));
    text.textContent = `${encoded.code[0]}  ${encoded.code.slice(1,7)}  ${encoded.code.slice(7)}`;
    svg.append(text);
    return svg;
  }

  function createQrCode(element) {
    const container = document.createElement("div");
    container.className = "report-qrcode";
    container.setAttribute("aria-label", `QR Code: ${element.content}`);
    if (typeof qrcode !== "function") {
      container.textContent = "Gerador QR indisponível";
      return container;
    }
    const qr = qrcode(0, "M");
    qr.addData(element.content, "Byte");
    qr.make();
    const count = qr.getModuleCount();
    const quiet = 4;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${count + quiet * 2} ${count + quiet * 2}`);
    svg.setAttribute("shape-rendering", "crispEdges");
    const background = document.createElementNS(svg.namespaceURI, "rect");
    background.setAttribute("width", "100%"); background.setAttribute("height", "100%"); background.setAttribute("fill", "#fff");
    svg.append(background);
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (!qr.isDark(row, col)) continue;
        const module = document.createElementNS(svg.namespaceURI, "rect");
        module.setAttribute("x", col + quiet); module.setAttribute("y", row + quiet);
        module.setAttribute("width", "1"); module.setAttribute("height", "1"); module.setAttribute("fill", "#000");
        svg.append(module);
      }
    }
    container.append(svg);
    return container;
  }

  function showReportConfirmation(program) {
    if (!confirmOverlayEl) { renderReport(program.report); return; }
    document.getElementById("confirmTitle").textContent = program.confirmation.title;
    document.getElementById("confirmText").textContent = program.confirmation.message;
    confirmOverlayEl.hidden = false;
    const yes = document.getElementById("confirmYes");
    yes.focus();
    yes.onclick = () => {
      confirmOverlayEl.hidden = true;
      setStatus("Processando relatório...", "success");
      renderReport(program.report);
    };
    document.getElementById("confirmNo").onclick = () => {
      confirmOverlayEl.hidden = true;
      setStatus("Geração do relatório cancelada.", "");
    };
  }

  function renderReport(report) {
    desktopEl.replaceChildren();
    const preview = document.createElement("section");
    preview.className = "report-preview";
    preview.dataset.advpl = "fwmsprinter-preview";
    const toolbar = document.createElement("div");
    toolbar.className = "report-toolbar";
    const info = document.createElement("span");
    info.textContent = `${report.engine} · ${report.paper} · ${report.orientation === "portrait" ? "Retrato" : "Paisagem"} · ${report.resolution} DPI`;
    const printButton = document.createElement("button");
    printButton.className = "primary";
    printButton.textContent = "Imprimir / Salvar PDF";
    printButton.addEventListener("click", () => window.print());
    toolbar.append(info, printButton);
    const page = document.createElement("article");
    page.className = "report-page " + (report.orientation === "landscape" ? "report-landscape" : "report-portrait");
    page.dataset.advpl = "fwmsprinter-page";
    page.dataset.orientation = report.orientation;
    let printPageStyle = document.getElementById("printPageStyle");
    if (!printPageStyle) {
      printPageStyle = document.createElement("style");
      printPageStyle.id = "printPageStyle";
      document.head.append(printPageStyle);
    }
    printPageStyle.textContent = `@page { size: A4 ${report.orientation}; margin: 0; }`;
    const heading = document.createElement("h2");
    heading.textContent = report.title;
    const ruleTop = document.createElement("hr");
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    report.headers.forEach(header => { const th = document.createElement("th"); th.textContent = header; headerRow.append(th); });
    thead.append(headerRow);
    const tbody = document.createElement("tbody");
    report.rows.forEach(row => {
      const tr = document.createElement("tr");
      row.forEach(value => { const td = document.createElement("td"); td.textContent = value; tr.append(td); });
      tbody.append(tr);
    });
    table.append(thead, tbody);
    const footer = document.createElement("footer");
    const left = document.createElement("span");
    left.textContent = `${report.footer.date}    ${report.footer.time}    ${report.footer.functionName}    ${report.footer.user}`;
    const right = document.createElement("span");
    right.textContent = `Página ${report.footer.page}`;
    footer.append(left, right);
    if (report.layout === "absolute") {
      page.classList.add("absolute-report");
      report.elements.forEach(element => {
        const rendered = element.type === "ean13" ? createEan13(element) : element.type === "qrcode" ? createQrCode(element) : document.createElement("div");
        rendered.classList.add("report-absolute-element");
        const coordinates = report.coordinateSystem || { scale: 1, offsetX: 0, offsetY: 0 };
        const x = value => coordinates.offsetX + value * coordinates.scale;
        const y = value => coordinates.offsetY + value * coordinates.scale;
        rendered.style.top = y(element.row) + "px"; rendered.style.left = x(element.col) + "px";
        if (element.type === "text") { rendered.textContent = element.text; rendered.style.color = element.color; if (report.engine === "TMSPrinter") { rendered.style.fontFamily = "Courier New"; rendered.style.fontSize = "13px"; } }
        else if (element.type === "qrcode") { rendered.style.width = element.size + "px"; rendered.style.height = element.size + "px"; }
        else if (element.type === "line") { rendered.classList.add("report-line"); rendered.style.width = (x(element.right) - x(element.col)) + "px"; rendered.style.height = "1px"; }
        else if (element.type === "box" || element.type === "fill") { rendered.classList.add(element.type === "box" ? "report-box" : "report-fill"); rendered.style.width = (x(element.right) - x(element.col)) + "px"; rendered.style.height = (y(element.bottom) - y(element.row)) + "px"; if (element.color) rendered.style.background = element.color; }
        else if (element.type === "bitmap") { rendered.classList.add("report-missing-bitmap"); rendered.title = `Bitmap não encontrado: ${element.path}`; rendered.style.width = (element.width * coordinates.scale) + "px"; rendered.style.height = (element.height * coordinates.scale) + "px"; }
        else { rendered.style.width = element.width + "px"; rendered.style.height = element.height + "px"; }
        page.append(rendered);
      });
    } else page.append(heading, ruleTop, table, footer);
    preview.append(toolbar, page);
    desktopEl.append(preview);
    const detail = report.layout === "absolute" ? `${report.elements.length} elemento(s)` : `${report.rows.length} registro(s)`;
    setStatus(`Relatório montado: ${detail}, 1 página.`, "success");
  }

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = "status" + (kind ? " " + kind : "");
  }

  let afterMessage = null;
  function showMessage(text, kind, done) {
    messageTextEl.textContent = text;
    overlayEl.classList.toggle("stop", kind === "stop");
    if (messageTitleEl) messageTitleEl.textContent = kind === "stop" ? "TOTVS" : "Informação";
    overlayEl.hidden = false;
    afterMessage = done || null;
    document.getElementById("messageOk").focus();
  }

  const defaultTables = globalThis.AdvPLSampleData?.tables || {};
  let runtimeTables = { ...defaultTables };

  function normalizeTables(data) {
    if (data == null) return {};
    let parsed = data;
    if (typeof parsed === "string") {
      try { parsed = JSON.parse(parsed); }
      catch (_error) { throw new Error("JSON de dados de exemplo inválido."); }
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.tables) parsed = parsed.tables;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Os dados de exemplo devem ser um objeto de tabelas.");
    const tables = {};
    for (const [alias, rows] of Object.entries(parsed)) {
      if (!/^[A-Za-z][A-Za-z0-9_]{0,15}$/.test(alias) || !Array.isArray(rows)) throw new Error(`Tabela de exemplo inválida: ${alias}.`);
      tables[alias.toUpperCase()] = rows;
    }
    return tables;
  }

  function setData(data) {
    runtimeTables = { ...defaultTables, ...normalizeTables(data) };
    return runtimeTables;
  }

  function runSource(source, data) {
    if (typeof source === "string") sourceEl.value = source;
    updateHighlighting();
    try {
      const tables = data === undefined ? runtimeTables : { ...defaultTables, ...normalizeTables(data) };
      const program = AdvPLCore.parse(sourceEl.value, { tables });
      render(program);
      return program;
    } catch (error) {
      setStatus(error.message, "error");
      throw error;
    }
  }

  if (emulatorConfig.data !== undefined || emulatorConfig.tables !== undefined) setData(emulatorConfig.data ?? emulatorConfig.tables);
  globalThis.AdvPLEmulator = Object.freeze({ run: runSource, setData, headless });
  document.getElementById("runButton").addEventListener("click", () => {
    try { runSource(); } catch (_error) { /* O status apresenta o diagnóstico. */ }
  });
  globalThis.addEventListener("message", event => {
    if (event.origin !== globalThis.location.origin || event.data?.type !== "advpl-emulator:run" || typeof event.data.source !== "string") return;
    try {
      runSource(event.data.source, event.data.data ?? event.data.tables);
      event.source?.postMessage({ type: "advpl-emulator:rendered" }, event.origin);
    } catch (error) {
      event.source?.postMessage({ type: "advpl-emulator:error", message: error.message }, event.origin);
    }
  });
  document.getElementById("messageOk").addEventListener("click", () => {
    overlayEl.hidden = true;
    const done = afterMessage;
    afterMessage = null;
    if (done) done();
  });
  sourceEl.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      document.getElementById("runButton").click();
    }
  });
  sourceEl.addEventListener("input", updateHighlighting);
  sourceEl.addEventListener("scroll", () => {
    if (!highlightingEl) return;
    highlightingEl.scrollTop = sourceEl.scrollTop;
    highlightingEl.scrollLeft = sourceEl.scrollLeft;
  });

  updateHighlighting();
  document.getElementById("runButton").click();
  if (globalThis.parent !== globalThis) globalThis.parent.postMessage({ type: "advpl-emulator:ready", headless }, globalThis.location.origin);
})();
