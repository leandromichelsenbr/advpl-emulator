/*
 * Coordena as duas etapas da execução didática:
 * 1. o parser TDS verifica a sintaxe sem produzir efeitos;
 * 2. o parser leve interpreta o subconjunto suportado e monta a saída visual.
 *
 * O módulo não conhece DOM, Web Worker ou AdvPLCore. As funções `analyze` e
 * `parse` são injetadas para que o fluxo possa ser reutilizado e testado.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AdvPLExecutionPipeline = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  /**
   * Cria uma sessão de execução. Cada sessão mantém sua própria revisão para
   * impedir que uma análise lenta substitua o resultado de uma execução nova.
   */
  function create({ analyze, parse }) {
    if (typeof analyze !== "function" || typeof parse !== "function") throw new TypeError("O pipeline exige analyze e parse.");
    let revision = 0;

    /**
     * Analisa e, somente quando não há erro, interpreta o fonte. O retorno
     * `stale: true` informa ao chamador que o resultado deve ser ignorado.
     */
    async function run(source, options = {}) {
      const currentRevision = ++revision;
      const analysis = await analyze(source, options.analysis || {});
      if (currentRevision !== revision) return { executed: false, stale: true, program: null, analysis };
      // Advertências não bloqueiam o exercício; apenas severidade "error" interrompe.
      const errors = (analysis.diagnostics || []).filter(diagnostic => diagnostic.severity === "error");
      if (errors.length) return { executed: false, stale: false, program: null, analysis };
      const program = parse(source, options.parser || {});
      if (currentRevision !== revision) return { executed: false, stale: true, program: null, analysis };
      program.parserAnalysis = analysis;
      program.diagnostics = [...(program.diagnostics || []), ...(analysis.diagnostics || [])];
      return { executed: true, stale: false, program, analysis };
    }

    /** Invalida uma análise pendente sem precisar encerrar à força seu Worker. */
    function cancel() {
      revision += 1;
    }

    return Object.freeze({ run, cancel, get revision() { return revision; } });
  }

  return Object.freeze({ create });
});
