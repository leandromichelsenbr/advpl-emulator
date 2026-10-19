/* Adapta snapshots da VM ao modelo neutro; não conhece DOM nem repete eventos. */
(function (root, factory) {
  const api = factory(
    typeof require === "function" ? require("./advpl-language-core.js") : root.AdvPLLanguageCore,
    typeof require === "function" ? require("./advpl-language-compiler.js") : root.AdvPLLanguageCompiler,
    typeof require === "function" ? require("./advpl-language-vm.js") : root.AdvPLLanguageVM,
    typeof require === "function" ? require("./advpl-model.js") : root.AdvPLModel
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AdvPLVMVisual = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (language, compiler, vm, model) {
  "use strict";

  function create(source, options = {}) {
    const preprocessing = options.preprocessing;
    const ast = language.parse(source, { filename: preprocessing?.map?.[0]?.originalFile || "<ppo>" });
    const bytecode = compiler.compile(language.bind(ast));
    const session = vm.createExecution(bytecode, {
      maxSteps: options.maxSteps, maxCallDepth: options.maxCallDepth,
      suspendOn: ["MSGINFO"]
    });
    const remap = item => {
      const origin = preprocessing?.map?.[Math.max(0, Number(item.line || 1) - 1)];
      return origin ? { ...item, generatedLine: item.line, file: origin.originalFile, line: origin.originalLine } : item;
    };
    const present = snapshot => {
      const messages = snapshot.events.filter(event => event.type === "message");
      const diagnostics = [...(options.diagnostics || []), ...snapshot.diagnostics.map(remap)];
      const variables = Object.fromEntries(Object.entries(bytecode.functions[bytecode.entry]?.slots || {}).map(([name, slot]) => [name, snapshot.locals[slot]]));
      const program = model.finalize({
        kind: messages.length ? "message" : "console", message: messages[0], messages,
        events: snapshot.events, console: snapshot.console, variables,
        diagnostics: diagnostics.filter((item, index) => index === diagnostics.findIndex(other =>
          other.code === item.code && other.origin === item.origin && other.file === item.file && other.line === item.line && other.column === item.column && other.message === item.message)),
        preprocessor: preprocessing,
        execution: { engine: "vm", state: snapshot.state, completed: snapshot.completed, steps: snapshot.steps, value: snapshot.value }
      });
      return { ...snapshot, program };
    };
    return Object.freeze({
      run: () => present(session.run()),
      resume: token => present(session.resume(token)),
      cancel: () => present(session.cancel()),
      snapshot: () => present(session.snapshot())
    });
  }

  return Object.freeze({ create });
});
