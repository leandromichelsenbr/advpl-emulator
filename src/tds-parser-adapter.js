(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AdvPLParserAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const CONTRACT_VERSION = "0.1";
  let requestId = 0;

  function syntaxDiagnostic(error) {
    const start = error?.location?.start || (Number(error?.line) ? error : error?.location) || {};
    return {
      code: "TDS_PARSE_ERROR",
      severity: "error",
      message: error?.message || "Falha na análise sintática AdvPL.",
      line: Number(start.line) || 1,
      column: Number(start.column) || 1,
      origin: "tds-parser"
    };
  }

  function lightResult(startedAt, fallbackUsed, reason) {
    return {
      version: CONTRACT_VERSION,
      parser: "light",
      ast: null,
      diagnostics: [],
      elapsedMs: Date.now() - startedAt,
      fallbackUsed,
      fallbackReason: reason || null
    };
  }

  function normalizeSuccess(result, startedAt) {
    if (result?.error) {
      return {
        version: CONTRACT_VERSION,
        parser: "tds-parsers@0.1.5",
        ast: null,
        diagnostics: [syntaxDiagnostic(result.error)],
        elapsedMs: Date.now() - startedAt,
        fallbackUsed: false,
        fallbackReason: null
      };
    }
    return {
      version: CONTRACT_VERSION,
      parser: "tds-parsers@0.1.5",
      ast: result?.ast || result,
      diagnostics: [],
      elapsedMs: Date.now() - startedAt,
      fallbackUsed: false,
      fallbackReason: null
    };
  }

  function analyzeWithWorker(source, options, startedAt) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(options.workerUrl || "src/tds-parser-worker.js");
      const id = ++requestId;
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error(`Tempo limite de ${options.timeoutMs} ms excedido pelo parser TDS.`));
      }, options.timeoutMs);
      worker.addEventListener("message", event => {
        if (event.data?.id !== id) return;
        clearTimeout(timeout);
        worker.terminate();
        if (event.data.ok) resolve(normalizeSuccess(event.data.ast, startedAt));
        else reject(Object.assign(new Error(event.data.error?.message), { location: event.data.error?.location }));
      });
      worker.addEventListener("error", error => {
        clearTimeout(timeout);
        worker.terminate();
        reject(error);
      });
      worker.postMessage({
        id,
        source,
        parserInfo: { parser: "advpl", fileext: "prw", filepath: options.filepath || "exercise.prw", debug: false }
      });
    });
  }

  async function analyze(source, suppliedOptions = {}) {
    const options = { mode: "auto", timeoutMs: 3000, ...suppliedOptions };
    const startedAt = Date.now();
    if (options.mode === "light") return lightResult(startedAt, false);
    try {
      if (typeof options.parser === "function") {
        const result = options.parser(String(source ?? ""), { parser: "advpl", fileext: "prw", filepath: options.filepath || "exercise.prw", debug: false });
        return normalizeSuccess(result, startedAt);
      }
      if (typeof Worker !== "function") throw new Error("Web Worker indisponível neste ambiente.");
      return await analyzeWithWorker(String(source ?? ""), options, startedAt);
    } catch (error) {
      if (error?.location) {
        return {
          version: CONTRACT_VERSION,
          parser: "tds-parsers@0.1.5",
          ast: null,
          diagnostics: [syntaxDiagnostic(error)],
          elapsedMs: Date.now() - startedAt,
          fallbackUsed: false,
          fallbackReason: null
        };
      }
      if (options.mode === "tds") throw error;
      return lightResult(startedAt, true, error?.message || String(error));
    }
  }

  return Object.freeze({ CONTRACT_VERSION, analyze, syntaxDiagnostic });
});
