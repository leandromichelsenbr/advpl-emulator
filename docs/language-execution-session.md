# Suspensão e retomada da VM experimental

## Contrato entregue em 0.28.0

`AdvPLLanguageVM.createExecution(bytecode, options)` cria uma sessão em memória sem executar o fonte. A sessão preserva pilha de operandos, frames de funções/blocos, contador de instrução, células capturadas, registro de closures, eventos e limites globais entre pausas.

| Método | Comportamento |
|---|---|
| `session.run()` | inicia uma sessão pronta e executa até concluir, falhar ou suspender; em uma pausa ou estado terminal apenas devolve o snapshot |
| `session.resume(token[, result])` | retoma exclusivamente a suspensão atual, colocando o retorno pendente na pilha antes de continuar |
| `session.cancel()` | cancela sessão pronta, ativa ou suspensa; nenhum efeito posterior é executado |
| `session.snapshot()` | consulta estado, resultados e saídas acumuladas sem executar instruções |

`options.suspendOn` é uma lista de nomes de serviços de runtime, comparados sem distinção de caixa, por exemplo `["MSGINFO"]`. Apenas chamadas de runtime efetivamente realizadas e encontradas podem suspender; chamadas a funções AdvPL declaradas não são interceptadas por essa lista. A seleção não muda a gramática, o bytecode nem o runtime permitido.

O efeito do serviço ocorre uma única vez, antes da pausa. Seu retorno ainda não é empilhado; a instrução já foi consumida e não é repetida na retomada. `resume(token)` usa o retorno original do serviço; `resume(token, result)` fornece o retorno do host. `null` ou `undefined` explícitos representam `Nil`. Isso permite, por exemplo, continuar uma soma cujo segundo operando depende de uma resposta do host.

`AdvPLLanguageVM.run(bytecode, options)` permanece uma chamada síncrona que esgota a execução até retorno ou falha. A seleção `suspendOn` só se aplica a `createExecution`; a API síncrona não suspende.

## Exemplo no console do navegador

Na distribuição 0.28.0, abra `index.html` e execute o trecho no console. Ele usa a VM diretamente; desde 0.29.0, o [modo visual experimental](vm-visual-integration.md) também permite testar pelo botão do playground.

```javascript
const source = `
User Function Demo()
Local n := 10
Local b := {|x| n += x, MsgInfo(cValToChar(n), "Total"), n}
ConOut(cValToChar(Eval(b, 2)))
Return Eval(b, 3)
`;
const ast = AdvPLLanguageCore.parse(source);
const bound = AdvPLLanguageCore.bind(ast);
const bytecode = AdvPLLanguageCompiler.compile(bound);
const session = AdvPLLanguageVM.createExecution(bytecode, {
  suspendOn: ["MSGINFO"]
});

const first = session.run();
console.log(first.state, first.events, first.console);
// suspended; mensagem "12"; console vazio

const second = session.resume(first.suspension.token);
console.log(second.state, second.events, second.console);
// suspended; mensagem "15" acrescentada; console ["12"]

const done = session.resume(second.suspension.token);
console.log(done.state, done.value, done.console);
// completed; 15; ["12"]
```

A sessão não cria modais ou elementos DOM: o host inspeciona as saídas e decide quando retomar. Eventos e console são cumulativos; um futuro renderer deve consumir apenas o trecho ainda não apresentado. Nenhum serviço posterior à pausa é antecipado.

## Estados e respostas atrasadas

Os estados são `ready`, `running`, `suspended`, `completed`, `failed` e `cancelled`. `completed` e `suspended` também aparecem como indicadores booleanos no resultado. O snapshot mantém os campos anteriores de `run`, incluindo `events`, `console`, `locals`, `value`, `steps` e `diagnostics`. Quando suspenso, acrescenta `suspension: { token, name, args, loc }`; nos demais estados, `suspension` é `null`.

Cada pausa tem um token opaco e distinto. O host deve guardar o token correspondente à interação apresentada e devolvê-lo na resposta. Tokens antigos, duplicados, copiados por serialização, forjados ou de outra sessão recebem `operationError.code: "LC_VM_INVALID_RESUME"`, sem alterar a sessão nem seus diagnósticos de fonte. A resposta válida atual ainda pode ser processada. Reentrada do host por `run`/`resume` durante um serviço recebe `LC_VM_REENTRANT`, também sem iniciar outra execução.

Cancelamento é terminal e idempotente. Não produz diagnóstico de fonte nem repete efeitos já realizados. `run()` após conclusão, falha ou cancelamento não reinicia o programa; uma nova execução exige uma nova sessão.

Snapshots copiam os arrays de eventos, console, locais e argumentos e os registros de eventos/diagnósticos/posição. Não expõem os frames, a pilha ou as células capturadas. Valores de aplicação contidos nesses arrays não são clonados profundamente. O token mantém identidade de objeto, não é um formato de persistência. A sessão não é serializável e não sobrevive ao recarregamento da página.

## Limites, falhas e próximos passos

Passos e profundidade são globais para a sessão inteira; nenhuma retomada renova o orçamento. Frames e capturas continuam compartilhados entre funções e blocos. Os limites padrão permanecem 10.000 passos e 128 frames.

Falhas de fonte/bytecode deixam a sessão em `failed`, sem permitir continuação. Além dos diagnósticos anteriores, `LC_RUNTIME_SERVICE_ERROR` informa falha de handler nativo e `LC_VM_MISSING_RETURN` identifica um frame de bytecode que terminou sem retorno. Não há novos opcodes; AST/ISA/VM permanecem `0.1` e a distribuição é `0.28.0`.

Esta API não agenda tarefas, não aguarda Promises nem oferece fatiamento automático por tempo. O host pode aguardar sua interação ou operação externa e depois chamar `resume` com o token correto. Desde 0.29.0, o modo visual experimental integra console e `MsgInfo`; desde 0.30.0 o playground inicia nesse modo com exemplo compatível e o exercício de MSDialog continua clássico. Objetos, diálogos e callbacks visuais gerais na VM permanecem pendentes.

`test/language-execution-session.test.js` cobre pausa/retorno, pilha intermediária, closures retornadas, múltiplas pausas, tokens, cancelamento, limites, falhas de serviço, reentrada e sessões intercaladas. O teste de carregamento autônomo verifica a mesma API sem CommonJS. Os cenários são sintéticos e não certificam PPO oficial ou compatibilidade integral com Protheus.
