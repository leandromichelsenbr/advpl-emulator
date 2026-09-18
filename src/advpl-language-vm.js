/* VM stack-based isolada: executa somente opcodes conhecidos e runtime registrado. */
(function (root, factory) {
  const api = factory(typeof require === "function" ? require("./advpl-core-runtime.js") : root.AdvPLCoreRuntime);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AdvPLLanguageVM = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (runtimeModule) {
  "use strict";
  const VM_VERSION = "0.1";
  const diagnostic = (code, message, instruction) => ({ code, severity: "error", message, line: instruction?.loc?.start?.line || 1, column: instruction?.loc?.start?.column || 1, origin: "language-vm", file: instruction?.loc?.start?.file || "<bytecode>" });

  function run(bytecode, options = {}) {
    const runtime = options.runtime || runtimeModule.create(), maxSteps = Number.isFinite(options.maxSteps) ? Math.max(1, Math.trunc(options.maxSteps)) : 10000;
    const maxCallDepth = Number.isFinite(options.maxCallDepth) ? Math.max(1, Math.trunc(options.maxCallDepth)) : 128;
    const events = [], consoleOutput = [], diagnostics = [...(bytecode?.diagnostics || [])], stack = [];
    const entryFn = bytecode?.functions?.[String(options.entry || bytecode?.entry || "").toUpperCase()];
    if (!entryFn) return { vmVersion: VM_VERSION, completed: false, value: null, events, console: consoleOutput, diagnostics: [...diagnostics, diagnostic("LC_VM_ENTRY", "Função de entrada não encontrada.")] };
    /** Cada chamada recebe seus próprios slots e contador de instrução. */
    const createFrame = (fn, args) => {
      const locals = Array(fn.localCount).fill(null);
      args.slice(0, fn.parameterCount).forEach((value, index) => { locals[index] = value; });
      return { fn, locals, ip: 0 };
    };
    let frame = createFrame(entryFn, options.args || []), steps = 0, completed = false, value = null;
    const rootLocals = frame.locals, callFrames = [];
    const fail = (code, message, instruction) => { diagnostics.push(diagnostic(code, message, instruction)); frame.ip = frame.fn.instructions.length; };
    const pop = instruction => { if (!stack.length) { fail("LC_VM_STACK_UNDERFLOW", `Pilha vazia em ${instruction.op}.`, instruction); return { ok: false }; } return { ok: true, value: stack.pop() }; };
    while (frame.ip < frame.fn.instructions.length && !diagnostics.some(item => item.severity === "error")) {
      const instructions = frame.fn.instructions;
      if (steps >= maxSteps) { fail("LC_RUNTIME_STEP_LIMIT", `Limite de ${maxSteps} passos excedido.`, instructions[frame.ip]); break; }
      steps += 1;
      const instruction = instructions[frame.ip++];
      if (instruction.op === "PUSH_CONST") stack.push(bytecode.constants[instruction.arg]);
      else if (instruction.op === "LOAD_LOCAL") stack.push(frame.locals[instruction.arg]);
      else if (instruction.op === "STORE_LOCAL") { const item = pop(instruction); if (item.ok) frame.locals[instruction.arg] = item.value; }
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
        const args = stack.splice(stack.length - instruction.argc, instruction.argc), called = runtime.call(instruction.name, args, { events, console: consoleOutput, locals: frame.locals });
        if (!called.found) fail("LC_RUNTIME_UNKNOWN_CALL", `Chamada não permitida: ${instruction.name}`, instruction); else stack.push(called.value);
      } else if (instruction.op === "POP") pop(instruction);
      else if (instruction.op === "RETURN") {
        const returned = pop(instruction);
        if (!returned.ok) continue;
        if (callFrames.length) { frame = callFrames.pop(); stack.push(returned.value); }
        else { value = returned.value; completed = true; break; }
      }
      else fail("LC_VM_UNKNOWN_OPCODE", `Opcode desconhecido: ${instruction.op}`, instruction);
    }
    return { vmVersion: VM_VERSION, bytecodeVersion: bytecode?.bytecodeVersion || null, completed, value, events, console: consoleOutput, locals: rootLocals, steps, diagnostics };
  }

  return Object.freeze({ VM_VERSION, run });
});
