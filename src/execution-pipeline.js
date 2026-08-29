(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AdvPLExecutionPipeline = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function create({ analyze, parse }) {
    if (typeof analyze !== "function" || typeof parse !== "function") throw new TypeError("O pipeline exige analyze e parse.");
    let revision = 0;

    async function run(source, options = {}) {
      const currentRevision = ++revision;
      const analysis = await analyze(source, options.analysis || {});
      if (currentRevision !== revision) return { executed: false, stale: true, program: null, analysis };
      const errors = (analysis.diagnostics || []).filter(diagnostic => diagnostic.severity === "error");
      if (errors.length) return { executed: false, stale: false, program: null, analysis };
      const program = parse(source, options.parser || {});
      if (currentRevision !== revision) return { executed: false, stale: true, program: null, analysis };
      program.parserAnalysis = analysis;
      program.diagnostics = [...(program.diagnostics || []), ...(analysis.diagnostics || [])];
      return { executed: true, stale: false, program, analysis };
    }

    function cancel() {
      revision += 1;
    }

    return Object.freeze({ run, cancel, get revision() { return revision; } });
  }

  return Object.freeze({ create });
});
