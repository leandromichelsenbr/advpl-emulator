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
  const VERSION = "0.2";
  const CAPABILITIES = Object.freeze({
    objectMacros: "supported",
    conditionalCompilation: "supported",
    undef: "supported",
    sourceMap: "line",
    includes: "supported",
    parameterMacros: "unsupported",
    translations: "unsupported",
    commands: "unsupported",
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
  function expandIdentifier(name, definitions, diagnostics, line, trail = []) {
    const key = name.toUpperCase(), definition = definitions.get(key);
    if (!definition) return name;
    if (trail.includes(key)) {
      const cycle = [...trail.slice(trail.indexOf(key)), key].join(" -> ");
      if (!diagnostics.some(item => item.code === "PP0005" && item.line === line && item.message.includes(cycle))) diagnostics.push(diagnostic("PP0005", "error", `Cyclic macro expansion: ${cycle}`, line));
      return name;
    }
    return expandText(definition.value, definitions, diagnostics, line, [...trail, key]).text;
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
    const trail = Array.isArray(state) ? state : [];
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
        result += expandIdentifier(text.slice(index, end), definitions, diagnostics, line, trail);
        index = end; continue;
      }
      result += char; index += 1;
    }
    return { text: result, blockComment };
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
      let blockComment = false;
      const active = () => conditions.every(frame => frame.active);
      lines.forEach((raw, index) => {
        const line = index + 1, context = { file, includeStack: [...includeStack] };
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
              const match = argument.match(/^([A-Za-z_]\w*)(?:\s+(.*))?$/);
              if (!match || !match[2]) diagnostics.push(diagnostic("PP0001", "error", "Invalid #define directive", line, 1, context));
              else { const key = match[1].toUpperCase(); if (definitions.has(key)) diagnostics.push(diagnostic("PP0002", "warning", `Macro redefined: ${match[1]}`, line, 1, context)); definitions.set(key, { name: match[1], value: match[2], line, file }); }
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
          } else {
            diagnostics.push(diagnostic("PP0001", "error", `Unsupported directive: #${directive[1]}`, line, 1, context));
            emit("", file, line);
          }
        } else if (!active()) emit("", file, line);
        else {
          const expanded = expandText(raw, definitions, diagnostics, line, { blockComment });
          if (expanded.text !== raw) applied.add("object-macro-expansion");
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
      source: output.join(input.includes("\r\n") ? "\r\n" : "\n"),
      map,
      definitions: Object.fromEntries([...definitions].map(([key, item]) => [key, item.value])),
      diagnostics
    };
  }
  return Object.freeze({ VERSION, CAPABILITIES, process });
});
