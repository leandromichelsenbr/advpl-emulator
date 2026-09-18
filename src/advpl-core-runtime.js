/* Core Runtime mínimo: serviços permitidos pela VM, sem avaliação de JavaScript. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AdvPLCoreRuntime = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const VERSION = "0.1";

  function advplText(value) {
    if (value === null || value === undefined) return "NIL";
    if (value === true) return ".T.";
    if (value === false) return ".F.";
    if (Array.isArray(value)) return `{${value.map(advplText).join(",")}}`;
    return String(value);
  }

  function create(custom = {}) {
    const services = new Map();
    const register = (name, handler) => services.set(String(name).toUpperCase(), handler);
    register("CVALTOCHAR", args => advplText(args[0]));
    register("ABS", args => Math.abs(Number(args[0])));
    register("CONOUT", (args, context) => {
      const text = advplText(args[0]);
      context.events.push({ type: "console", text });
      context.console.push(text);
      return null;
    });
    register("MSGINFO", (args, context) => {
      context.events.push({ type: "message", kind: "info", text: advplText(args[0]), title: args.length > 1 ? advplText(args[1]) : "TOTVS" });
      return null;
    });
    for (const [name, handler] of Object.entries(custom)) if (typeof handler === "function") register(name, handler);
    return Object.freeze({
      version: VERSION,
      has(name) { return services.has(String(name).toUpperCase()); },
      call(name, args, context) {
        const handler = services.get(String(name).toUpperCase());
        return handler ? { found: true, value: handler(args, context) } : { found: false, value: null };
      }
    });
  }

  return Object.freeze({ VERSION, create, advplText });
});
