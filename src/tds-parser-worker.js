/* global TDSParserRuntime */
"use strict";

importScripts("../vendor/tds-parser.bundle.js?v=0.3.0.1");

self.addEventListener("message", event => {
  const { id, source, parserInfo } = event.data || {};
  try {
    const result = TDSParserRuntime.parser(String(source ?? ""), parserInfo);
    if (result?.error) throw result.error;
    const ast = result?.ast || result;
    self.postMessage({ id, ok: true, ast: JSON.parse(JSON.stringify(ast)) });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: {
        message: error?.message || String(error),
        location: error?.location?.start || (Number(error?.line) ? { line: error.line, column: error.column } : error?.location) || null
      }
    });
  }
});
