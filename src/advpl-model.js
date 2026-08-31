/*
 * MODELO INTERMEDIÁRIO
 * --------------------
 * Este módulo fica entre o interpretador AdvPL e os renderizadores. O núcleo
 * consegue produzir mensagens, console, diálogos, grades e relatórios, mas um
 * backend não deveria precisar adivinhar qual dessas estruturas recebeu.
 *
 * A solução é um "envelope": um pequeno conjunto de campos que existe em toda
 * saída. `outputType` funciona como discriminador, enquanto `events`,
 * `controls`, `diagnostics` e `variables` sempre usam tipos previsíveis. Os
 * payloads especializados continuam intactos para não quebrar consumidores da
 * API 0.1. Esse desenho é semelhante a uma união discriminada: primeiro o
 * consumidor olha a família; depois interpreta os campos daquela variante.
 *
 * O módulo usa o padrão UMD para funcionar tanto por `<script>` no navegador
 * quanto por `require()` nos testes Node, sem depender de DOM ou de framework.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AdvPLModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // MODEL_VERSION evolui quando o formato consumido pelos backends muda de
  // maneira incompatível. Ele é independente da versão do pacote e da API.
  const MODEL_VERSION = "0.1";
  const OUTPUT_TYPES = Object.freeze(["message", "console", "dialog", "grid", "report"]);
  const EVENT_TYPES = Object.freeze(["message", "console", "dialog", "report-create", "report-setup", "report-preview"]);

  /**
   * Deduz a família de uma estrutura antiga.
   *
   * A ordem é intencional. Mensagem, console e relatório já possuíam `kind`
   * igual à família. AxCadastro e FWMBrowse usam `kind` para distinguir duas
   * variantes, portanto convergem para `grid`. Diálogos antigos não tinham
   * `kind`; a presença do payload `dialog` é o seu discriminador histórico.
   * Retornar `null` é preferível a inventar uma família e esconder um produtor
   * incompatível.
   */
  function outputTypeOf(program) {
    if (!program || typeof program !== "object") return null;
    if (program.kind === "message" || program.kind === "console" || program.kind === "report") return program.kind;
    if (program.kind === "axcadastro" || program.kind === "fwmbrowse") return "grid";
    if (program.dialog) return "dialog";
    return null;
  }

  /**
   * Completa somente o envelope comum.
   *
   * O spread copia primeiro o programa original. Depois, os campos do envelope
   * são escritos de forma canônica. Arrays ausentes tornam-se arrays vazios e
   * `variables` torna-se um dicionário sem protótipo. Isso permite que um
   * backend percorra as coleções sem testes defensivos repetidos.
   *
   * O objeto original não é mutado. Essa propriedade facilita comparar a saída
   * bruta e a normalizada em testes e evita efeitos colaterais entre backends.
   */
  function finalize(program) {
    if (program == null) return program;
    const outputType = outputTypeOf(program);
    if (!outputType) throw new TypeError("O programa não possui uma família de saída reconhecida.");
    return {
      ...program,
      modelVersion: MODEL_VERSION,
      outputType,
      events: Array.isArray(program.events) ? program.events : [],
      controls: Array.isArray(program.controls) ? program.controls : [],
      diagnostics: Array.isArray(program.diagnostics) ? program.diagnostics : [],
      variables: program.variables && typeof program.variables === "object" ? program.variables : Object.create(null)
    };
  }

  /**
   * Verifica o envelope sem lançar exceção.
   *
   * Validadores de integração devem conseguir reunir todos os problemas de uma
   * vez; por isso o retorno contém `{ valid, errors }`, em vez de interromper na
   * primeira falha. A validação não tenta validar cada célula, controle ou
   * elemento gráfico: no contrato 0.1 ela protege apenas a fronteira comum e a
   * coerência entre o discriminador e o payload.
   */
  function validate(program) {
    const errors = [];
    if (!program || typeof program !== "object") return { valid: false, errors: ["model must be an object"] };
    if (program.modelVersion !== MODEL_VERSION) errors.push(`modelVersion must be ${MODEL_VERSION}`);
    if (!OUTPUT_TYPES.includes(program.outputType)) errors.push("outputType is invalid");
    if (outputTypeOf(program) !== program.outputType) errors.push("outputType does not match the payload");
    for (const field of ["events", "controls", "diagnostics"]) if (!Array.isArray(program[field])) errors.push(`${field} must be an array`);
    if (!program.variables || typeof program.variables !== "object" || Array.isArray(program.variables)) errors.push("variables must be an object");
    for (const event of program.events || []) if (!EVENT_TYPES.includes(event?.type)) errors.push(`event type is invalid: ${event?.type}`);
    return { valid: errors.length === 0, errors };
  }

  return Object.freeze({ MODEL_VERSION, OUTPUT_TYPES, EVENT_TYPES, outputTypeOf, finalize, validate });
});
