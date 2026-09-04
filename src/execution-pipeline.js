/*
 * Coordena as três etapas da execução didática:
 * 1. o pré-processador seleciona ramos e expande macros;
 * 2. o parser TDS verifica a sintaxe sem produzir efeitos;
 * 3. o parser leve interpreta o subconjunto suportado e monta a saída visual.
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
   * Cria uma sessão de execução.
   *
   * As dependências são injetadas para que o pipeline não conheça implementações
   * concretas. Nos testes podemos fornecer analisadores controlados; no browser,
   * `analyze` usa o Worker TDS e `parse` usa AdvPLCore.
   *
   * Cada sessão mantém uma revisão monotônica. Se o usuário executar A e logo
   * depois B, o Worker de A pode terminar por último. Comparar a revisão antes
   * de publicar cada resultado impede que A sobrescreva visualmente B.
   */
  function create({ analyze, parse, preprocess = source => ({ source, diagnostics: [], map: [] }) }) {
    if (typeof analyze !== "function" || typeof parse !== "function") throw new TypeError("O pipeline exige analyze e parse.");
    let revision = 0;

    /**
     * Executa o pipeline respeitando a fronteira de efeitos.
     *
     * Pré-processamento e análise sintática são fases sem efeitos visuais. O
     * parser leve só é chamado quando ambas não possuem diagnósticos de erro.
     * Advertências são preservadas, mas não bloqueiam o exercício. O retorno
     * `stale: true` é uma instrução para descartar o resultado silenciosamente,
     * pois uma execução mais recente já representa a intenção atual do usuário.
     */
    async function run(source, options = {}) {
      const currentRevision = ++revision;
      // O TDS recebe o fonte processado: sintaxe inválida em um ramo inativo não
      // deve bloquear o programa. O executor recebe o original e pré-processa
      // internamente, preservando metadados e o mapa de origem no modelo final.
      const preprocessing = preprocess(source, options.preprocessor || {});
      const preprocessingErrors = (preprocessing.diagnostics || []).filter(diagnostic => diagnostic.severity === "error");
      if (preprocessingErrors.length) {
        const analysis = { parser: "preprocessor", ast: null, diagnostics: preprocessing.diagnostics, preprocessing };
        return { executed: false, stale: false, program: null, analysis };
      }
      const analysis = await analyze(preprocessing.source, options.analysis || {});
      analysis.preprocessing = preprocessing;
      // O parser analisa o PPO. Reassociamos cada posição ao arquivo virtual e
      // à linha de origem para que um erro dentro de um .CH não pareça pertencer
      // ao fonte principal. A posição gerada continua disponível para depuração.
      analysis.diagnostics = (analysis.diagnostics || []).map(item => {
        const origin = preprocessing.map?.[Math.max(0, Number(item.line || 1) - 1)];
        return origin ? { ...item, generatedLine: item.line, file: origin.originalFile, line: origin.originalLine } : item;
      });
      analysis.diagnostics = [...(preprocessing.diagnostics || []), ...(analysis.diagnostics || [])];
      if (currentRevision !== revision) return { executed: false, stale: true, program: null, analysis };
      // Advertências não bloqueiam o exercício; apenas severidade "error" interrompe.
      const errors = (analysis.diagnostics || []).filter(diagnostic => diagnostic.severity === "error");
      if (errors.length) return { executed: false, stale: false, program: null, analysis };
      const program = parse(source, { ...(options.parser || {}), preprocessor: options.preprocessor || {} });
      if (currentRevision !== revision) return { executed: false, stale: true, program: null, analysis };
      program.parserAnalysis = analysis;
      // O mesmo diagnóstico do pré-processador pode chegar pelos dois caminhos:
      // anexado pelo núcleo e anexado à análise. A chave composta evita duplicar
      // a advertência sem apagar ocorrências realmente distintas em outra linha.
      const diagnostics = [...(program.diagnostics || []), ...(analysis.diagnostics || [])];
      program.diagnostics = diagnostics.filter((item, index) => index === diagnostics.findIndex(candidate =>
        candidate.code === item.code && candidate.origin === item.origin && candidate.line === item.line && candidate.column === item.column && candidate.message === item.message
      ));
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
