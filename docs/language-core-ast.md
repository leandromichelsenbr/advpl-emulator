# Contrato experimental da AST do Language Core

## Estado e objetivo

A AST `0.1` é um contrato experimental para iniciar o Language Core sobre texto PPO. Ela não substitui o executor leve, não representa a AST interna de `@totvs/tds-parsers` e não afirma compatibilidade com toda a gramática AdvPL. A evidência inicial é a fixture sintética `test/fixtures/ppo-input/message.ppo`; pares oficiais PRW/PPO continuam pendentes.

O módulo `src/advpl-language-core.js` separa três operações:

1. `tokenize(source, options)` cria tokens posicionados e diagnósticos léxicos;
2. `parse(source, options)` cria a AST sem executar efeitos;
3. `bind(program)` registra funções, parâmetros e variáveis locais sem resolver APIs Protheus.

## Envelope do programa

```js
{
  type: "Program",
  astVersion: "0.1",
  sourceType: "ppo",
  experimental: true,
  body: [],
  diagnostics: [],
  loc: { start, end }
}
```

Cada posição contém `file`, `line`, `column` e `offset`. Linhas e colunas começam em 1; offset começa em 0.

## Nós cobertos

| Nó | Cobertura inicial |
|---|---|
| `FunctionDeclaration` | `User Function` e `Static Function`, nome, parâmetros e corpo |
| `LocalDeclaration` | uma variável e inicializador opcional |
| `ReturnStatement` | retorno vazio ou com expressão |
| `ExpressionStatement` | chamada ou expressão em uma linha |
| `CallExpression` | identificador como callee e argumentos posicionais |
| `BinaryExpression` | `==`, `!=`, `+`, `-`, `*` e `/`, com precedência |
| `UnaryExpression` | sinais unários `+` e `-` |
| `IfStatement` | condição, bloco consequente e bloco alternativo opcional |
| `AssignmentStatement` | atribuição a local/parâmetro com `:=` ou `+=` |
| `ForStatement` | variável de controle, início, limite, passo e corpo |
| `ParenthesizedExpression` | expressão explicitamente agrupada |
| `Identifier` | nome preservado como escrito |
| `Literal` | texto, número e `Nil` |

O parser cobre inicialmente `If`/`Else`/`EndIf`, `For`/`To`/`Step`/`Next`, blocos aninhados, comparações e atribuições `:=`/`+=` a símbolos vinculados. `Step` omitido é representado por literal sintético `1`; `Next` aceita opcionalmente o nome da variável e diagnostica divergência. Ainda não cobre `ElseIf`, `While`, arrays, code blocks, métodos, outros destinos de atribuição, operadores completos ou construções visuais.

## Binder inicial

O binder devolve uma tabela de funções e, para cada função, símbolos de parâmetros e locais. Duplicidades recebem `LC0201` ou `LC0202`; atribuições a símbolos não vinculados recebem `LC0203`; variável de controle do `For` não vinculada recebe `LC0204`. Chamadas como `MsgInfo` e `ConOut` não são declaradas implicitamente: a resolução de built-ins e APIs Protheus pertence ao Core Runtime e à camada de compatibilidade.

## Relação com contratos existentes

- AST descreve o programa.
- Bytecode/ISA `0.1` descreve a primeira fatia experimental de execução; veja [ISA, compiler e VM](language-core-isa.md).
- Modelo intermediário `0.1` descreve a saída visual e eventos.
- AST do TDS continua encapsulada pelo adaptador opcional e não é exposta como este contrato.

O executor leve continua sendo o caminho de produção. As versões `0.22.0` a `0.25.0` entregam compiler/VM e equivalência para console, condição, atribuição, função auxiliar e `For`. A migração só avançará capacidade por capacidade, com equivalência comprovada e sem retirar prematuramente o fallback atual.
