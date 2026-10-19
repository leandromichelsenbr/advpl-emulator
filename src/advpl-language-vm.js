/* VM stack-based isolada: executa somente opcodes conhecidos e runtime registrado. */
(function (root, factory) {
  const api = factory(typeof require === "function" ? require("./advpl-core-runtime.js") : root.AdvPLCoreRuntime);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AdvPLLanguageVM = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (runtimeModule) {
  "use strict";
  const VM_VERSION = "0.1";
  const diagnostic = (code, message, instruction) => ({ code, severity: "error", message, line: instruction?.loc?.start?.line || 1, column: instruction?.loc?.start?.column || 1, origin: "language-vm", file: instruction?.loc?.start?.file || "<bytecode>" });

  function createExecution(bytecode, options = {}) {
    const runtime = options.runtime || runtimeModule.create(), maxSteps = Number.isFinite(options.maxSteps) ? Math.max(1, Math.trunc(options.maxSteps)) : 10000;
    const maxCallDepth = Number.isFinite(options.maxCallDepth) ? Math.max(1, Math.trunc(options.maxCallDepth)) : 128;
    const events = [], consoleOutput = [], diagnostics = [...(bytecode?.diagnostics || [])], stack = [], codeBlocks = new WeakMap();
    const entryFn = bytecode?.functions?.[String(options.entry || bytecode?.entry || "").toUpperCase()];
    const suspendOn = new Set((Array.isArray(options.suspendOn) ? options.suspendOn : []).map(name => String(name).toUpperCase()));
    if (!entryFn) diagnostics.push(diagnostic("LC_VM_ENTRY", "Função de entrada não encontrada."));
    /** Cada chamada recebe seus próprios slots e contador de instrução. */
    const createFrame = (fn, args, captures = []) => {
      const locals = Array(fn.localCount).fill(null);
      args.slice(0, fn.parameterCount).forEach((value, index) => { locals[index] = value; });
      return { fn, locals, captures, ip: 0 };
    };
    let frame = entryFn ? createFrame(entryFn, options.args || []) : null, steps = 0, completed = false, value = null;
    let state = diagnostics.some(item => item.severity === "error") ? "failed" : "ready", pending = null;
    const rootLocals = frame?.locals || [], callFrames = [];
    const copyLoc = loc => loc ? { start: { ...loc.start }, end: { ...loc.end } } : undefined;
    /** Snapshots não expõem pilha, frames, células ou o registro privado das closures. */
    const snapshot = () => ({
      vmVersion: VM_VERSION, bytecodeVersion: bytecode?.bytecodeVersion || null,
      state, completed, suspended: state === "suspended", value,
      events: events.map(event => ({ ...event })), console: [...consoleOutput],
      locals: [...rootLocals], steps, diagnostics: diagnostics.map(item => ({ ...item })),
      suspension: pending ? { token: pending.token, name: pending.name, args: [...pending.args], loc: copyLoc(pending.loc) } : null
    });
    const operationError = (code, message) => ({ ...snapshot(), operationError: diagnostic(code, message) });
    const fail = (code, message, instruction) => { diagnostics.push(diagnostic(code, message, instruction)); state = "failed"; };
    const pop = instruction => { if (!stack.length) { fail("LC_VM_STACK_UNDERFLOW", `Pilha vazia em ${instruction.op}.`, instruction); return { ok: false }; } return { ok: true, value: stack.pop() }; };
    function drive() {
      state = "running";
      while (state === "running" && frame.ip < frame.fn.instructions.length) {
        const instructions = frame.fn.instructions;
        if (steps >= maxSteps) { fail("LC_RUNTIME_STEP_LIMIT", `Limite de ${maxSteps} passos excedido.`, instructions[frame.ip]); break; }
        steps += 1;
        const instruction = instructions[frame.ip++];
        if (instruction.op === "PUSH_CONST") stack.push(bytecode.constants[instruction.arg]);
        else if (instruction.op === "LOAD_LOCAL") stack.push(frame.locals[instruction.arg]);
        else if (instruction.op === "STORE_LOCAL") { const item = pop(instruction); if (item.ok) frame.locals[instruction.arg] = item.value; }
        else if (instruction.op === "DUP") { const item = pop(instruction); if (item.ok) stack.push(item.value, item.value); }
        else if (instruction.op === "LOAD_CAPTURE" || instruction.op === "STORE_CAPTURE") {
          const cell = Number.isInteger(instruction.arg) && instruction.arg >= 0 ? frame.captures[instruction.arg] : null;
          if (!cell) { fail("LC_VM_INVALID_CAPTURE", "Captura de bloco inválida.", instruction); continue; }
          if (instruction.op === "LOAD_CAPTURE") stack.push(cell.locals[cell.slot]);
          else { const item = pop(instruction); if (item.ok) cell.locals[cell.slot] = item.value; }
        } else if (instruction.op === "MAKE_BLOCK") {
          const fn = bytecode?.blocks?.[instruction.arg];
          if (!fn || !Array.isArray(fn.captures)) { fail("LC_VM_INVALID_BLOCK", "Definição de bloco inválida.", instruction); continue; }
          const captures = fn.captures.map(source => {
            if (source?.kind === "local" && Number.isInteger(source.index) && source.index >= 0 && source.index < frame.locals.length) return { locals: frame.locals, slot: source.index };
            if (source?.kind === "capture" && Number.isInteger(source.index) && source.index >= 0) return frame.captures[source.index];
            return null;
          });
          if (captures.some(cell => !cell)) { fail("LC_VM_INVALID_CAPTURE", "Origem de captura inválida.", instruction); continue; }
          const block = Object.freeze({ type: "codeblock" });
          codeBlocks.set(block, { fn, captures }); stack.push(block);
        } else if (instruction.op === "CALL_BLOCK") {
          if (!Number.isInteger(instruction.argc) || instruction.argc < 0 || stack.length < instruction.argc + 1) { fail("LC_VM_STACK_UNDERFLOW", "Argumentos insuficientes para Eval.", instruction); continue; }
          const args = stack.splice(stack.length - instruction.argc, instruction.argc), block = stack.pop();
          const closure = block && typeof block === "object" ? codeBlocks.get(block) : null;
          if (!closure) { fail("LC_VM_NOT_BLOCK", "Eval exige um bloco criado nesta execução.", instruction); continue; }
          if (callFrames.length + 1 >= maxCallDepth) { fail("LC_RUNTIME_CALL_DEPTH", `Limite de ${maxCallDepth} frames excedido.`, instruction); continue; }
          callFrames.push(frame); frame = createFrame(closure.fn, args, closure.captures);
        }
        else if (instruction.op === "NEG") { const item = pop(instruction); if (item.ok) stack.push(-Number(item.value)); }
        else if (["ADD", "SUB", "MUL", "DIV", "EQ", "NE", "LT", "LE", "GT", "GE"].includes(instruction.op)) {
          const right = pop(instruction), left = pop(instruction); if (!right.ok || !left.ok) continue;
          if (instruction.op === "ADD") stack.push(typeof left.value === "number" && typeof right.value === "number" ? left.value + right.value : String(left.value ?? "") + String(right.value ?? ""));
          else if (instruction.op === "SUB") stack.push(Number(left.value) - Number(right.value));
          else if (instruction.op === "MUL") stack.push(Number(left.value) * Number(right.value));
          else if (instruction.op === "DIV") stack.push(Number(left.value) / Number(right.value));
          else if (instruction.op === "EQ") stack.push(left.value === right.value);
          else if (instruction.op === "NE") stack.push(left.value !== right.value);
          else if (instruction.op === "LT") stack.push(left.value < right.value);
          else if (instruction.op === "LE") stack.push(left.value <= right.value);
          else if (instruction.op === "GT") stack.push(left.value > right.value);
          else stack.push(left.value >= right.value);
        } else if (instruction.op === "JUMP" || instruction.op === "JUMP_IF_FALSE") {
          const target = instruction.arg;
          if (!Number.isInteger(target) || target < 0 || target > instructions.length) { fail("LC_VM_INVALID_JUMP", `Destino de salto inválido: ${target}.`, instruction); continue; }
          if (instruction.op === "JUMP") frame.ip = target;
          else { const condition = pop(instruction); if (condition.ok && !condition.value) frame.ip = target; }
        } else if (instruction.op === "CALL_FUNCTION") {
          if (stack.length < instruction.argc) { fail("LC_VM_STACK_UNDERFLOW", `Argumentos insuficientes para ${instruction.name}.`, instruction); continue; }
          const target = bytecode?.functions?.[instruction.name];
          if (!target) { fail("LC_VM_UNKNOWN_FUNCTION", `Função AdvPL não encontrada: ${instruction.name}`, instruction); continue; }
          if (callFrames.length + 1 >= maxCallDepth) { fail("LC_RUNTIME_CALL_DEPTH", `Limite de ${maxCallDepth} frames excedido.`, instruction); continue; }
          const args = stack.splice(stack.length - instruction.argc, instruction.argc);
          callFrames.push(frame); frame = createFrame(target, args);
        } else if (instruction.op === "CALL_RUNTIME") {
          if (stack.length < instruction.argc) { fail("LC_VM_STACK_UNDERFLOW", `Argumentos insuficientes para ${instruction.name}.`, instruction); continue; }
          const args = stack.splice(stack.length - instruction.argc, instruction.argc);
          let called;
          try { called = runtime.call(instruction.name, args, { events, console: consoleOutput, locals: frame.locals }); }
          catch (_) { fail("LC_RUNTIME_SERVICE_ERROR", `Falha no serviço: ${instruction.name}`, instruction); continue; }
          if (state !== "running") continue;
          if (!called?.found) fail("LC_RUNTIME_UNKNOWN_CALL", `Chamada não permitida: ${instruction.name}`, instruction);
          else if (suspendOn.has(String(instruction.name).toUpperCase())) {
            // O efeito já ocorreu e o IP já avançou. Só o retorno fica pendente.
            pending = { token: Object.freeze({}), name: instruction.name, args: [...args], loc: instruction.loc, defaultValue: called.value };
            state = "suspended";
          } else stack.push(called.value);
        } else if (instruction.op === "POP") pop(instruction);
        else if (instruction.op === "RETURN") {
          const returned = pop(instruction);
          if (!returned.ok) continue;
          if (callFrames.length) { frame = callFrames.pop(); stack.push(returned.value); }
          else { value = returned.value; completed = true; state = "completed"; break; }
        }
        else fail("LC_VM_UNKNOWN_OPCODE", `Opcode desconhecido: ${instruction.op}`, instruction);
      }
      if (state === "running") fail("LC_VM_MISSING_RETURN", "Frame terminou sem instrução de retorno.");
      return snapshot();
    }

    return Object.freeze({
      run() {
        if (state === "running") return operationError("LC_VM_REENTRANT", "A execução já está ativa.");
        return state === "ready" ? drive() : snapshot();
      },
      resume(token, result) {
        if (state === "running") return operationError("LC_VM_REENTRANT", "A execução já está ativa.");
        if (state !== "suspended" || token !== pending.token) return operationError("LC_VM_INVALID_RESUME", "Retomada exige o token da suspensão atual.");
        const returned = arguments.length > 1 ? (result ?? null) : pending.defaultValue;
        pending = null; stack.push(returned);
        return drive();
      },
      cancel() {
        if (["ready", "running", "suspended"].includes(state)) { pending = null; state = "cancelled"; }
        return snapshot();
      },
      snapshot
    });
  }

  // Compatibilidade: a API síncrona anterior sempre esgota a execução, sem suspender.
  function run(bytecode, options = {}) { return createExecution(bytecode, { ...options, suspendOn: [] }).run(); }

  return Object.freeze({ VM_VERSION, run, createExecution });
});
