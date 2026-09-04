/*
 * PRÉ-PROCESSADOR ADVPL CONTROLADO
 * --------------------------------
 * O pré-processamento acontece antes do parser. Sua responsabilidade é decidir
 * quais linhas existem para a compilação e substituir macros textuais. Ele não
 * executa AdvPL e não tenta reproduzir todo o compilador da TOTVS.
 *
 * Há três ideias centrais neste arquivo:
 *
 * 1. `definitions` é uma tabela de símbolos. As chaves são normalizadas para
 *    maiúsculas porque nomes AdvPL são tratados sem diferença de caixa.
 * 2. `conditions` é uma pilha. Cada `#ifdef`/`#ifndef` empilha um quadro e cada
 *    `#endif` o remove. O topo sabe se seu ramo está ativo e se já houve `#else`.
 * 3. `expandText` é um scanner de estados. Ele caminha caractere por caractere
 *    para distinguir código, string, comentário de linha e comentário de bloco.
 *    Uma expressão regular global não seria segura: substituiria nomes dentro
 *    de textos e comentários, alterando o significado do fonte.
 *
 * Linhas de diretiva e ramos inativos viram linhas vazias, não são removidos.
 * Assim, a linha 20 processada ainda corresponde à linha 20 original. Esse é o
 * primeiro mapa de origem; versões futuras poderão detalhar também colunas.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AdvPLPreprocessor = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const VERSION = "0.4";
  const CAPABILITIES = Object.freeze({
    objectMacros: "supported",
    conditionalCompilation: "supported",
    undef: "supported",
    sourceMap: "line",
    includes: "supported",
    parameterMacros: "supported",
    translations: "recognized",
    commands: "recognized",
    embeddedSql: "unsupported"
  });
  // Todos os diagnósticos recebem a mesma origem para não serem confundidos
  // com mensagens do parser TDS ou com aproximações de assinatura do emulador.
  const diagnostic = (code, severity, message, line, column = 1, details = {}) => ({ code, severity, message, line, column, origin: "preprocessor", ...details });

  /**
   * Forma um sistema de arquivos virtual, limitado ao manifesto informado pela
   * integração. Nenhum caminho é lido do computador ou solicitado pela rede.
   * As chaves são comparadas sem diferença de caixa e com barras normalizadas,
   * reproduzindo o uso habitual dos headers AdvPL sem abrir acesso ao host.
   */
  function normalizeIncludes(values = {}) {
    const entries = values && typeof values === "object" && !Array.isArray(values) ? Object.entries(values) : [];
    return new Map(entries.map(([name, content]) => [normalizeIncludeName(name).toUpperCase(), { name: normalizeIncludeName(name), content: String(content ?? "") }]));
  }

  function normalizeIncludeName(name) {
    return String(name ?? "").trim().replace(/\\/g, "/").replace(/^\.\//, "");
  }

  // Includes virtuais aceitam somente nomes relativos confinados à raiz lógica.
  function safeIncludeName(name) {
    const normalized = normalizeIncludeName(name);
    return normalized && !/^(?:[A-Za-z]:|\/)/.test(normalized) && !normalized.split("/").includes("..");
  }

  function parseInclude(argument) {
    const match = String(argument).trim().match(/^(?:"([^"]+)"|<([^>]+)>)$/);
    return match ? normalizeIncludeName(match[1] || match[2]) : null;
  }

  // Comentários pertencem à diretiva, não ao texto substituído pela macro.
  function cleanMacroValue(value) {
    let quote = null;
    for (let index = 0; index < value.length; index += 1) {
      const char = value[index], next = value[index + 1];
      if (quote) {
        if (char === quote) {
          if (next === quote) { index += 1; continue; }
          quote = null;
        }
        continue;
      }
      if (char === '"' || char === "'") quote = char;
      else if (char === "/" && next === "/") return value.slice(0, index).trimEnd();
      else if (char === "/" && next === "*") return value.slice(0, index).trimEnd();
    }
    return value.trimEnd();
  }

  /**
   * Converte símbolos externos em uma tabela uniforme. `line: 0` informa que o
   * símbolo veio do perfil de execução, e não de uma linha `#define` do fonte.
   */
  const normalizeDefines = (values = {}) => new Map(Object.entries(values).map(([name, value]) => [name.toUpperCase(), { name, value: String(value), line: 0 }]));

  /**
   * Resolve uma macro recursivamente.
   *
   * `trail` representa o caminho de expansão atual. Para `A -> B -> A`, a
   * segunda visita a A revela o ciclo. Essa técnica é a mesma ideia usada em
   * busca em profundidade de grafos: o caminho corrente detecta ciclos sem
   * proibir que uma macro válida seja utilizada novamente em outro contexto.
   * Quando há ciclo, preservamos o identificador em vez de produzir texto
   * parcial imprevisível, e registramos somente um diagnóstico equivalente.
   */
  function expandIdentifier(name, definitions, diagnostics, line, trail = [], context = {}, metrics = { parameterExpanded: false }) {
    const key = name.toUpperCase(), definition = definitions.get(key);
    if (!definition || definition.parameters) return name;
    if (trail.includes(key)) {
      const cycle = [...trail.slice(trail.indexOf(key)), key].join(" -> ");
      if (!diagnostics.some(item => item.code === "PP0005" && item.line === line && item.message.includes(cycle))) diagnostics.push(diagnostic("PP0005", "error", `Cyclic macro expansion: ${cycle}`, line, 1, context));
      return name;
    }
    return expandText(definition.value, definitions, diagnostics, line, { trail: [...trail, key], context, metrics }).text;
  }

  /** Separa argumentos de uma chamada de macro sem confundir estruturas internas. */
  function parseMacroArguments(text, openIndex) {
    const args = [];
    let start = openIndex + 1, depth = 0, quote = null, blockComment = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index], next = text[index + 1];
      if (blockComment) { if (char === "*" && next === "/") { blockComment = false; index += 1; } continue; }
      if (quote) { if (char === quote) { if (next === quote) index += 1; else quote = null; } continue; }
      if (char === '"' || char === "'") { quote = char; continue; }
      if (char === "/" && next === "*") { blockComment = true; index += 1; continue; }
      if (char === "(") depth += 1;
      else if (char === ")") {
        if (depth === 0) {
          const final = text.slice(start, index).trim();
          if (final || args.length) args.push(final);
          return { args, end: index + 1 };
        }
        depth -= 1;
      } else if (char === "," && depth === 0) { args.push(text.slice(start, index).trim()); start = index + 1; }
    }
    return null;
  }

  function expandParameterized(name, definition, call, definitions, diagnostics, line, trail, context, metrics) {
    const key = name.toUpperCase();
    if (trail.includes(key)) {
      const cycle = [...trail.slice(trail.indexOf(key)), key].join(" -> ");
      diagnostics.push(diagnostic("PP0005", "error", `Cyclic macro expansion: ${cycle}`, line, 1, context));
      return name;
    }
    if (call.args.length !== definition.parameters.length) {
      diagnostics.push(diagnostic("PP0014", "error", `Macro ${name} expects ${definition.parameters.length} argument(s), received ${call.args.length}`, line, 1, context));
      return `${name}(${call.args.join(", ")})`;
    }
    // Argumentos são expandidos antes de entrarem no corpo. Isso permite
    // `SOMA(1, SOMA(2, 3))` sem confundir a chamada interna com recursão do
    // corpo externo; somente depois a macro corrente entra na trilha de ciclo.
    const expandedArgs = call.args.map(argument => expandText(argument, definitions, diagnostics, line, { trail, context, metrics }).text);
    const scoped = new Map(definitions);
    definition.parameters.forEach((parameter, index) => scoped.set(parameter.toUpperCase(), { name: parameter, value: expandedArgs[index], line, parameters: null }));
    metrics.parameterExpanded = true;
    return expandText(definition.value, scoped, diagnostics, line, { trail: [...trail, key], context, metrics }).text;
  }

  /**
   * Expande identificadores somente em regiões de código.
   *
   * A cada caractere o scanner está em um destes estados:
   * - comentário de bloco: copia até encontrar `*` seguido de `/`;
   * - string: copia até a mesma aspa, aceitando aspas duplicadas;
   * - código: reconhece comentários, abre strings ou coleta identificadores.
   *
   * `blockComment` entra e sai da função porque um comentário pode começar em
   * uma linha e terminar em outra. Já `quote` é local: strings multilinha não
   * fazem parte do subconjunto atual. O retorno inclui o novo estado para que
   * `process()` o entregue à próxima linha.
   */
  function expandText(text, definitions, diagnostics, line, state = []) {
    let result = "", index = 0, quote = null, blockComment = state.blockComment === true;
    const trail = Array.isArray(state) ? state : state.trail || [], context = Array.isArray(state) ? {} : state.context || {}, metrics = Array.isArray(state) ? { parameterExpanded: false } : state.metrics || { parameterExpanded: false };
    while (index < text.length) {
      const char = text[index], next = text[index + 1];
      if (blockComment) {
        result += char;
        if (char === "*" && next === "/") { result += next; index += 2; blockComment = false; } else index += 1;
        continue;
      }
      if (quote) {
        result += char;
        if (char === quote) {
          if (next === quote) { result += next; index += 2; continue; }
          quote = null;
        }
        index += 1; continue;
      }
      if (char === "/" && next === "/") { result += text.slice(index); break; }
      if (char === "/" && next === "*") { result += "/*"; index += 2; blockComment = true; continue; }
      if (char === '"' || char === "'") { quote = char; result += char; index += 1; continue; }
      if (/[A-Za-z_]/.test(char)) {
        let end = index + 1;
        while (end < text.length && /[A-Za-z0-9_]/.test(text[end])) end += 1;
        const name = text.slice(index, end), definition = definitions.get(name.toUpperCase());
        // Literais e operadores AdvPL (`.T.`, `.F.`, `.AND.`, `.OR.`, `.NOT.`)
        // usam palavras entre pontos, mas não são identificadores substituíveis.
        if (text[index - 1] === "." && text[end] === ".") { result += name; index = end; continue; }
        let open = end;
        while (open < text.length && /\s/.test(text[open])) open += 1;
        if (definition?.parameters && text[open] === "(") {
          const call = parseMacroArguments(text, open);
          if (!call) {
            diagnostics.push(diagnostic("PP0015", "error", `Unclosed invocation of macro ${name}`, line, index + 1, context));
            result += text.slice(index); break;
          }
          result += expandParameterized(name, definition, call, definitions, diagnostics, line, trail, context, metrics);
          index = call.end; continue;
        }
        result += expandIdentifier(name, definitions, diagnostics, line, trail, context, metrics);
        index = end; continue;
      }
      result += char; index += 1;
    }
    return { text: result, blockComment, parameterExpanded: metrics.parameterExpanded };
  }

  /**
   * Processa um fonte completo e devolve um resultado observável.
   *
   * O algoritmo percorre as linhas uma única vez. Diretivas condicionais são
   * processadas mesmo quando seu ramo está inativo, pois ainda precisamos
   * localizar `#else` e `#endif`. Em contraste, `#define`, `#undef` e `#include`
   * só produzem efeito no ramo ativo, reproduzindo a intuição do pré-processador.
   *
   * Cada quadro de `conditions` contém:
   * - `parentActive`: se todos os níveis externos estavam ativos ao abrir;
   * - `condition`: resultado próprio do `#ifdef`/`#ifndef`;
   * - `active`: combinação do pai com o resultado próprio;
   * - `elseSeen`: impede um segundo `#else` no mesmo nível;
   * - `line`: local da abertura, usado no diagnóstico de bloco incompleto.
   */
  function process(source, options = {}) {
    const input = String(source ?? ""), definitions = normalizeDefines(options.defines), includes = normalizeIncludes(options.includes);
    const diagnostics = [], output = [], map = [], applied = new Set(), entryName = normalizeIncludeName(options.filename || "<source>");
    const maxIncludeDepth = Number.isFinite(options.maxIncludeDepth) ? Math.max(0, Math.trunc(options.maxIncludeDepth)) : 16;

    // Acrescentar texto e mapa no mesmo ponto evita que a numeração gerada se
    // desalinhe quando um único #include introduz várias linhas no PPO.
    const emit = (text, file, line) => {
      output.push(text);
      map.push({ generatedLine: output.length, originalFile: file, originalLine: line, originalColumn: 1 });
    };

    function processFile(content, file, includeStack) {
      const lines = String(content).split(/\r?\n/), conditions = [];
      let blockComment = false, ignoredDirectiveContinuation = false;
      const active = () => conditions.every(frame => frame.active);
      lines.forEach((raw, index) => {
        const line = index + 1, context = { file, includeStack: [...includeStack] };
        // Regras #command/#translate podem ocupar várias linhas terminadas por
        // `;`. Enquanto a gramática não for implementada, todo o corpo precisa
        // desaparecer do PPO; deixar as continuações produziria AdvPL inválido.
        if (ignoredDirectiveContinuation) {
          ignoredDirectiveContinuation = /;\s*$/.test(raw);
          emit("", file, line);
          return;
        }
        const directive = raw.match(/^\s*#\s*([A-Za-z]+)(?:\s+(.*?))?\s*$/);
        if (directive && !blockComment) {
          const command = directive[1].toLowerCase(), argument = directive[2] || "", identifier = argument.match(/^([A-Za-z_]\w*)/)?.[1] || null;
          if (command === "ifdef" || command === "ifndef") {
            applied.add("conditional-compilation");
            const parentActive = active();
            if (!identifier || argument.trim() !== identifier) diagnostics.push(diagnostic("PP0001", "error", `Invalid #${command} directive`, line, 1, context));
            const exists = identifier ? definitions.has(identifier.toUpperCase()) : false, condition = command === "ifdef" ? exists : !exists;
            conditions.push({ parentActive, condition, active: parentActive && condition, elseSeen: false, line, file });
            emit("", file, line);
          } else if (command === "else") {
            applied.add("conditional-compilation");
            const frame = conditions.at(-1);
            if (!frame || argument) diagnostics.push(diagnostic("PP0003", "error", "Unmatched or invalid #else", line, 1, context));
            else if (frame.elseSeen) diagnostics.push(diagnostic("PP0003", "error", "Duplicate #else", line, 1, context));
            else { frame.elseSeen = true; frame.active = frame.parentActive && !frame.condition; }
            emit("", file, line);
          } else if (command === "endif") {
            applied.add("conditional-compilation");
            if (!conditions.length || argument) diagnostics.push(diagnostic("PP0003", "error", "Unmatched or invalid #endif", line, 1, context)); else conditions.pop();
            emit("", file, line);
          } else if (command === "define") {
            if (active()) {
              applied.add("object-macro-definition");
              // Assim como no pré-processador C/AdvPL, a lista formal precisa
              // começar imediatamente após o nome. `#define LISTA ({...})` é
              // uma macro de objeto cujo valor apenas começa com parênteses.
              const parameterMacro = argument.match(/^([A-Za-z_]\w*)\(([^)]*)\)\s*(.*)$/);
              const match = parameterMacro ? null : argument.match(/^([A-Za-z_]\w*)(?:\s+(.*))?$/);
              if (parameterMacro) {
                const parameters = parameterMacro[2].trim() ? parameterMacro[2].split(",").map(item => item.trim()) : [];
                const valid = parameters.every(item => /^[A-Za-z_]\w*$/.test(item)) && new Set(parameters.map(item => item.toUpperCase())).size === parameters.length;
                if (!valid) diagnostics.push(diagnostic("PP0016", "error", `Invalid parameters in macro ${parameterMacro[1]}`, line, 1, context));
                else {
                  const key = parameterMacro[1].toUpperCase();
                  if (definitions.has(key)) diagnostics.push(diagnostic("PP0002", "warning", `Macro redefined: ${parameterMacro[1]}`, line, 1, context));
                  definitions.set(key, { name: parameterMacro[1], parameters, value: cleanMacroValue(parameterMacro[3]), line, file });
                  applied.add("parameter-macro-definition");
                }
              } else if (!match) diagnostics.push(diagnostic("PP0001", "error", "Invalid #define directive", line, 1, context));
              else { const key = match[1].toUpperCase(), value = cleanMacroValue(match[2] || ""); if (definitions.has(key)) diagnostics.push(diagnostic("PP0002", "warning", `Macro redefined: ${match[1]}`, line, 1, context)); definitions.set(key, { name: match[1], parameters: null, value, line, file }); }
            }
            emit("", file, line);
          } else if (command === "undef") {
            if (active()) {
              applied.add("macro-undefinition");
              if (!identifier || argument.trim() !== identifier) diagnostics.push(diagnostic("PP0001", "error", "Invalid #undef directive", line, 1, context)); else definitions.delete(identifier.toUpperCase());
            }
            emit("", file, line);
          } else if (command === "include") {
            if (!active()) emit("", file, line);
            else {
              applied.add("include-recognition");
              const requested = parseInclude(argument);
              if (!requested || !safeIncludeName(requested)) {
                diagnostics.push(diagnostic("PP0007", "error", `Invalid or unsafe include: ${argument || "<missing>"}`, line, 1, context));
                emit("", file, line);
              } else {
                const included = includes.get(requested.toUpperCase());
                if (!included) {
                  diagnostics.push(diagnostic("PP0006", "warning", `Include recognized but not provided: ${requested}`, line, 1, context));
                  emit("", file, line);
                } else if (includeStack.some(name => name.toUpperCase() === included.name.toUpperCase())) {
                  diagnostics.push(diagnostic("PP0008", "error", `Cyclic include: ${[...includeStack, included.name].join(" -> ")}`, line, 1, context));
                  emit("", file, line);
                } else if (includeStack.length > maxIncludeDepth) {
                  diagnostics.push(diagnostic("PP0009", "error", `Maximum include depth exceeded: ${maxIncludeDepth}`, line, 1, context));
                  emit("", file, line);
                } else {
                  applied.add("include-expansion");
                  processFile(included.content, included.name, [...includeStack, included.name]);
                }
              }
            }
          } else if (["command", "xcommand", "translate", "xtranslate"].includes(command) && file !== entryName) {
            applied.add(command.includes("command") ? "command-recognition" : "translation-recognition");
            const code = command.includes("command") ? "PP0012" : "PP0013";
            if (!diagnostics.some(item => item.code === code && item.file === file)) diagnostics.push(diagnostic(code, "warning", `#${command} rules recognized but not applied in ${file}`, line, 1, context));
            ignoredDirectiveContinuation = /;\s*$/.test(raw);
            emit("", file, line);
          } else {
            diagnostics.push(diagnostic("PP0001", "error", `Unsupported directive: #${directive[1]}`, line, 1, context));
            emit("", file, line);
          }
        } else if (!active()) emit("", file, line);
        else {
          const expanded = expandText(raw, definitions, diagnostics, line, { blockComment, context });
          if (expanded.text !== raw) applied.add("object-macro-expansion");
          if (expanded.parameterExpanded) applied.add("parameter-macro-expansion");
          emit(expanded.text, file, line);
          blockComment = expanded.blockComment;
        }
      });
      for (const frame of conditions) diagnostics.push(diagnostic("PP0004", "error", `Conditional opened at line ${frame.line} is not closed`, frame.line, 1, { file: frame.file, includeStack: [...includeStack] }));
    }

    processFile(input, entryName, [entryName]);
    // O discriminador identifica a natureza do texto, não o sucesso da fase.
    // Mesmo com erros há uma saída inspecionável; diagnostics decide se ela
    // pode seguir no pipeline. Cada chamada recebe metadados independentes.
    const artifact = {
      kind: "didactic-ppo",
      label: "PPO didático — subconjunto do emulador",
      compatibility: "partial"
    };
    return {
      version: VERSION,
      artifact,
      capabilities: { ...CAPABILITIES },
      applied: [...applied],
      includeCatalog: options.includeCatalog || null,
      source: output.join(input.includes("\r\n") ? "\r\n" : "\n"),
      map,
      definitions: Object.fromEntries([...definitions].map(([key, item]) => [key, item.value])),
      diagnostics
    };
  }
  return Object.freeze({ VERSION, CAPABILITIES, process });
});
