# Blocos de código na VM experimental

## Recorte entregue em 0.27.0

O Language Core aceita `{|| expressão}` e `{|a, b| expressão1, expressão2}`. O bloco é um valor: criá-lo não executa o corpo. `Eval(bloco, argumentos...)` cria um frame e devolve a última expressão. Os argumentos são avaliados da esquerda para a direita; parâmetros omitidos recebem `Nil` e argumentos excedentes são ignorados, preservando a convenção atual dos frames de funções.

```advpl
User Function Demo()
Local total := 0
Local sum := {|n| total += n, total}
ConOut(cValToChar(Eval(sum, 2))) // 2
ConOut(cValToChar(Eval(sum, 3))) // 5
Return total
```

Parâmetros têm escopo próprio e podem sombrear nomes externos. Locais e parâmetros externos usados pelo bloco são capturados por referência à célula da variável. Alterações posteriores são observadas por todos os blocos que compartilham essa célula. Uma closure retornada mantém as capturas durante a execução mesmo após o retorno da função criadora. Chamadas diferentes da função criadora têm células independentes. Capturas transitivas permitem blocos aninhados.

O parser também representa atribuições como expressões: `:=` e `+=` devolvem o valor armazenado e associam da direita para a esquerda. O corpo é uma sequência não vazia de expressões separadas por vírgula; declarações e comandos de controle dentro do literal não fazem parte deste recorte. O bloco pode chamar funções que usam `If`, `For` ou `While`.

## Representação e execução

- AST `CodeBlockExpression`: `params`, `expressions` e `loc`.
- AST `AssignmentExpression`: `name`, `operator`, `value` e `loc`.
- Bytecode contém tabela `blocks`, separada das funções declaradas.
- Cada definição de bloco declara parâmetros, instruções e descritores `captures` com `kind: local/capture` e `index`, relativos ao frame criador.
- `MAKE_BLOCK` cria um valor opaco da VM; `CALL_BLOCK` implementa o intrínseco `Eval`.
- `LOAD_CAPTURE`/`STORE_CAPTURE` acessam as células e `DUP` preserva o retorno das atribuições.

`Eval` usa a mesma pilha de frames, o mesmo runtime permitido e os mesmos limites globais de passos e profundidade das funções. A VM não usa avaliação de JavaScript nem chamadas recursivas do host para executar o bloco. Valores forjados e blocos de outra execução são recusados: a identidade é mantida internamente em um `WeakMap` por execução. Esse valor não é um formato serializável. Desde 0.28.0, [sessões](language-execution-session.md) preservam o registro de closures entre pausas e retomadas; uma nova execução continua não aceitando blocos de outra sessão.

Os contratos experimentais AST/ISA/VM continuam `0.1` com extensões aditivas. Uma VM anterior não reconhece os novos opcodes; compiler e VM devem ser distribuídos juntos. Os parâmetros e opcodes existentes mantêm seu comportamento.

## Diagnósticos

| Código | Situação |
|---|---|
| `LC0101`, `LC0102`, `LC0105` | delimitadores, expressões ou parâmetros ausentes/inválidos |
| `LC0109` | atribuição a destino que não é identificador |
| `LC0203` | atribuição a variável não vinculada |
| `LC0205` | parâmetros duplicados no mesmo bloco |
| `LC0302` | leitura de identificador não vinculado |
| `LC0306` | `Eval()` sem bloco |
| `LC_VM_NOT_BLOCK` | valor comum, forjado ou de outra execução passado a `Eval` |
| `LC_VM_INVALID_BLOCK`, `LC_VM_INVALID_CAPTURE` | definição ou referência de captura inconsistente |
| `LC_RUNTIME_STEP_LIMIT`, `LC_RUNTIME_CALL_DEPTH` | orçamento global de instruções ou frames excedido |

## Evidência e limites

`test/fixtures/ppo-input/code-blocks.ppo` é sintética e não foi gerada pelo toolchain TOTVS. `language-code-blocks.test.js` cobre sintaxe, vinculação, ordem de efeitos, captura compartilhada, fábricas isoladas, retorno de closures, parâmetros, aninhamento, recursão, limites e falhas de bytecode. A comparação com o executor leve usa lógica direta equivalente, pois esse executor ainda não executa blocos de código gerais. O teste de carregamento autônomo também executa um bloco sem CommonJS.

A semântica-alvo é orientada pela documentação oficial de [Blocos de Código](https://tdn.totvs.com/pages/viewpage.action?pageId=6063094) e [Eval](https://tdn.totvs.com/display/framework/Eval), sem declarar compatibilidade integral. Corpus PPO oficial, arrays, parâmetros por referência, escopos `Private`/`Public`, macroexecução, métodos e callbacks visuais permanecem pendentes. Suspensão/retomada foi entregue em 0.28.0; a integração visual inicial de console e `MsgInfo` foi entregue em 0.29.0 como modo opcional do playground; os componentes clássicos continuam no executor leve.
